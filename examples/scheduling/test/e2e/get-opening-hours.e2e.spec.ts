import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { cacheTag, tenantCacheTags } from '@ddd-ts-kit/kernel';
import { createHttpClient, eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { NETWORK } from '$test/e2e/support/create-credentials';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

/** Set by the pipeline once Varnish runs with the VCL of docker/varnish in front of the backend port. */
const VARNISH_URL = process.env['VARNISH_URL'] ?? '';
const THROUGH_VARNISH = VARNISH_URL !== '';

interface OpeningHours {
  readonly calendarId: string;
  readonly version: number;
  readonly ranges: readonly { readonly weekday: string; readonly start: string; readonly end: string }[];
}

const mornings = { ranges: [{ weekday: 'monday', start: '09:00', end: '12:00' }] };
const closedOnMonday = { day: '2026-03-02', ranges: [] };
const afternoons = { ranges: [{ weekday: 'monday', start: '14:00', end: '18:00' }] };

describe('Get opening hours, end to end: what a cache may keep, and its purge after the change', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let practitioner: HttpClient;
  let hoursPath: string;
  let exceptionsPath: string;

  beforeAll(async () => {
    application = await startApplication({ behindVarnish: THROUGH_VARNISH });
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
    practice = await openStaffedPractice(application, riverside);
    practitioner = await application.as({ id: practice.practitionerId });
    hoursPath = '/calendars/' + practice.calendarId + '/opening-hours';
    exceptionsPath = '/calendars/' + practice.calendarId + '/exceptions';
    // Setting up the practice set the hours and defined a consultation, each purging the calendar: a test starts after both.
    const calendar = calendarTag(practice.calendarId);

    await eventually(() => expect(application.purges.purged.filter((tag) => tag === calendar)).toHaveLength(2));
    application.purges.purged.splice(0);
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('answers the hours to anybody, kept by every cache, filed under the calendar, and 304 to who holds them', async () => {
    const read = expectStatus(await application.client.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

    expect(read.headers['cache-control']).toBe(
      'public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400',
    );

    expect(read.headers['etag']).toBe(`W/"${read.body.version}"`);
    expect(read.headers['xkey']).toBe(calendarTag(practice.calendarId));

    const conditional = inNetwork(NETWORK, { 'if-none-match': read.headers['etag'] ?? '' });
    const again = await application.client.get(hoursPath, conditional);

    expect(again.status).toBe(304);
  });

  it('keeps the day of a calendar in the browser of its caller only, asked again each time, 304 when nothing changed', async () => {
    const dayPath = '/calendars/' + practice.calendarId + '/days/2026-03-02';
    const read = expectStatus(await practitioner.get(dayPath), 200);
    const again = await practitioner.get(dayPath, { headers: { 'if-none-match': read.headers['etag'] ?? '' } });

    expect(read.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    expect(read.headers['xkey']).toBeUndefined();
    expect(again.status).toBe(304);
  });

  it('purges the hours once the command that changes them committed, and nothing for a command refused', async () => {
    const backwards = { ranges: [{ weekday: 'monday', start: '12:00', end: '09:00' }] };

    expectProblem(await practitioner.put(hoursPath, backwards), { status: 422, code: 'INVALID_RANGE' });
    expectStatus(await practitioner.put(hoursPath, mornings), 200);

    // The refused command wrote no purge request: the only purge is the one of the change committed after it.
    await eventually(() => expect(application.purges.purged).toEqual([calendarTag(practice.calendarId)]));
  });

  it('answers 412 to a change made on hours that changed since they were read, and makes it on the current version', async () => {
    const read = expectStatus(await application.client.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);
    const onTheVersionRead = { headers: { 'if-match': read.headers['etag'] ?? '' } };

    expectStatus(await practitioner.put(hoursPath, mornings, onTheVersionRead), 200);

    expectProblem(await practitioner.put(hoursPath, afternoons, onTheVersionRead), {
      status: 412,
      code: 'PRECONDITION_FAILED',
    });

    const current = expectStatus(await application.client.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

    expect(current.body.version).toBe(read.body.version + 1);
    expect(current.body.ranges).toEqual(mornings.ranges);
  });

  it('purges the hours after any change of the calendar, so that the version they name is the one a change is made on', async () => {
    expectStatus(await practitioner.post(exceptionsPath, closedOnMonday), 201);

    await eventually(() => expect(application.purges.purged).toEqual([calendarTag(practice.calendarId)]));

    const read = expectStatus(await application.client.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

    expectStatus(
      await practitioner.put(hoursPath, mornings, { headers: { 'if-match': read.headers['etag'] ?? '' } }),
      200,
    );
  });

  it('answers 404 to a calendar that does not exist, which no cache keeps', async () => {
    const missing = await application.client.get('/calendars/no-such-calendar/opening-hours', inNetwork(NETWORK));

    expectProblem(missing, { status: 404, code: 'UNKNOWN_CALENDAR' });
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  describe.runIf(THROUGH_VARNISH)('through Varnish', () => {
    it('serves, once another change of the calendar committed, the version a change of the hours is then made on', async () => {
      const varnish = createHttpClient(VARNISH_URL);

      await varnish.get(hoursPath, inNetwork(NETWORK));
      expectStatus(await practitioner.post(exceptionsPath, closedOnMonday), 201);

      const current = expectStatus(await application.client.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

      await eventually(async () => {
        const fresh = expectStatus(await varnish.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

        expect(fresh.body.version).toBe(current.body.version);
      });

      const served = expectStatus(await varnish.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);
      const onTheVersionServed = { headers: { 'if-match': served.headers['etag'] ?? '' } };

      expectStatus(await practitioner.put(hoursPath, mornings, onTheVersionServed), 200);
    });

    it('serves the hours from Varnish until the command that changes them, then the new ones', async () => {
      const varnish = createHttpClient(VARNISH_URL);

      await varnish.get(hoursPath, inNetwork(NETWORK));

      const cached = expectStatus(await varnish.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

      expect(cached.headers['x-cache']).toBe('HIT');
      expect(cached.headers['xkey']).toBeUndefined();

      expectStatus(await practitioner.put(hoursPath, afternoons), 200);

      await eventually(async () => {
        const fresh = expectStatus(await varnish.get<OpeningHours>(hoursPath, inNetwork(NETWORK)), 200);

        expect(fresh.body.ranges).toEqual(afternoons.ranges);
      });
    });
  });
});

describe('Get opening hours, end to end: the copy of one network is never the answer of another', () => {
  let application: RunningApplication;
  let hoursPath: string;

  beforeAll(async () => {
    application = await startApplication({ behindVarnish: THROUGH_VARNISH });
    await application.reset();

    const { calendarId } = await openStaffedPractice(application, riverside);

    hoursPath = '/calendars/' + calendarId + '/opening-hours';
  });

  afterAll(async () => {
    await application.close();
  });

  it('names the network header in Vary, so that a shared cache keeps one copy per network', async () => {
    const read = expectStatus(await application.client.get(hoursPath, inNetwork(NETWORK)), 200);

    expect(read.headers['vary']?.toLowerCase()).toContain('x-tenant-id');
  });

  it('answers 404 to the calendar of another network, whoever asks there, which no cache keeps', async () => {
    const elsewhere = await application.client.get(hoursPath, inNetwork('south'));

    expectProblem(elsewhere, { status: 404, code: 'UNKNOWN_CALENDAR' });
    expect(elsewhere.headers['cache-control']).toBe('no-store');
  });

  it.runIf(THROUGH_VARNISH)('keeps one copy per network in Varnish, never served to another network', async () => {
    const varnish = createHttpClient(VARNISH_URL);

    expectStatus(await varnish.get(hoursPath, inNetwork(NETWORK)), 200);
    expect(expectStatus(await varnish.get(hoursPath, inNetwork(NETWORK)), 200).headers['x-cache']).toBe('HIT');
    expectProblem(await varnish.get(hoursPath, inNetwork('south')), { status: 404, code: 'UNKNOWN_CALENDAR' });
  });
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };

/** An anonymous caller names the network it reads in (ADR-0003): the answer is kept and purged per network. */
function inNetwork(network: string, headers: Readonly<Record<string, string>> = {}) {
  return { headers: { 'x-tenant-id': network, ...headers } };
}

/** The tag of the calendar, filed under the network of the request as every tag of this application. */
function calendarTag(calendarId: string, network = NETWORK): string | undefined {
  return tenantCacheTags([cacheTag('calendar', calendarId)], network)[0];
}
