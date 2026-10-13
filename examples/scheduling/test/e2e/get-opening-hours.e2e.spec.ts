import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { cacheTag } from '@ddd-ts-kit/kernel';
import { createHttpClient, eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
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
const afternoons = { ranges: [{ weekday: 'monday', start: '14:00', end: '18:00' }] };

describe('Get opening hours, end to end: what a cache may keep, and its purge after the change', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let practitioner: HttpClient;
  let hoursPath: string;

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
    // Setting up the practice set the hours once: what a test purges starts after that purge.
    await eventually(() => expect(application.purges.purged).toContain(cacheTag('calendar', practice.calendarId)));
    application.purges.purged.splice(0);
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('answers the hours to anybody, kept by every cache, filed under the calendar, and 304 to who holds them', async () => {
    const read = expectStatus(await application.client.get<OpeningHours>(hoursPath), 200);

    expect(read.headers['cache-control']).toBe(
      'public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400',
    );

    expect(read.headers['etag']).toBe(`W/"${read.body.version}"`);
    expect(read.headers['xkey']).toBe(cacheTag('calendar', practice.calendarId));

    const again = await application.client.get(hoursPath, { headers: { 'if-none-match': read.headers['etag'] ?? '' } });

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
    await eventually(() => expect(application.purges.purged).toEqual([cacheTag('calendar', practice.calendarId)]));
  });

  it('answers 412 to a change made on hours that changed since they were read, and makes it on the current version', async () => {
    const read = expectStatus(await application.client.get<OpeningHours>(hoursPath), 200);
    const onTheVersionRead = { headers: { 'if-match': read.headers['etag'] ?? '' } };

    expectStatus(await practitioner.put(hoursPath, mornings, onTheVersionRead), 200);

    expectProblem(await practitioner.put(hoursPath, afternoons, onTheVersionRead), {
      status: 412,
      code: 'PRECONDITION_FAILED',
    });

    const current = expectStatus(await application.client.get<OpeningHours>(hoursPath), 200);

    expect(current.body.version).toBe(read.body.version + 1);
    expect(current.body.ranges).toEqual(mornings.ranges);
  });

  it('answers 404 to a calendar that does not exist, which no cache keeps', async () => {
    const missing = await application.client.get('/calendars/no-such-calendar/opening-hours');

    expectProblem(missing, { status: 404, code: 'UNKNOWN_CALENDAR' });
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  describe.runIf(THROUGH_VARNISH)('through Varnish', () => {
    it('serves the hours from Varnish until the command that changes them, then the new ones', async () => {
      const varnish = createHttpClient(VARNISH_URL);

      await varnish.get(hoursPath);

      const cached = expectStatus(await varnish.get<OpeningHours>(hoursPath), 200);

      expect(cached.headers['x-cache']).toBe('HIT');
      expect(cached.headers['xkey']).toBeUndefined();

      expectStatus(await practitioner.put(hoursPath, afternoons), 200);

      await eventually(async () => {
        const fresh = expectStatus(await varnish.get<OpeningHours>(hoursPath), 200);

        expect(fresh.body.ranges).toEqual(afternoons.ranges);
      });
    });
  });
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };
