import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { bookAppointment } from '$test/e2e/support/book-appointment';
import { NETWORK } from '$test/e2e/support/create-credentials';
import { inNetwork } from '$test/e2e/support/in-network';
import type { Listed } from '$test/e2e/support/listed';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

interface Identified {
  readonly id: string;
}

interface AuditLine {
  readonly action: string;
  readonly reason?: string;
  readonly actorId: string;
  readonly tenantId?: string;
  readonly resourceId?: string;
}

/** The second network of the test environment (`NETWORKS`): its people, its practice, its patient. */
const OTHER_NETWORK = 'south';
const startsAt = slotStarting({ days: 7 });

let application: RunningApplication;
let north: StaffedPractice;
let south: StaffedPractice;
let paul: HttpClient;
let sven: HttpClient;

beforeAll(async () => {
  application = await startApplication();
});

afterAll(async () => {
  await application.close();
});

beforeEach(async () => {
  const other = inNetwork(application, OTHER_NETWORK);

  await application.reset();
  north = await openStaffedPractice(application, riverside);
  south = await openStaffedPractice(other, hillside);
  await registerPeople(application, 'paul');
  await registerPeople(other, 'sven');
  paul = await application.as({ id: 'paul', roles: ['patient'] });
  sven = await other.as({ id: 'sven', roles: ['patient'] });
});

describe('Two networks of practices served by one application', () => {
  it('keeps the data of one network out of the reach of the other: its calendars are not found there', async () => {
    const day = startsAt.toISOString().slice(0, 10);
    const dayOfNorth = '/calendars/' + north.calendarId + '/days/' + day;

    expectStatus(await paul.get(dayOfNorth), 200);
    expectStatus(await sven.get(dayOfNorth), 404);
    expectStatus(await bookAppointment(sven, north, { startsAt }), 404);
    expectStatus(await bookAppointment(sven, south, { startsAt }), 201);
  });

  it('lists to the people of a network the appointments of that network only', async () => {
    const ofPaul = expectStatus(await bookAppointment(paul, north, { startsAt }), 201).body.id;
    const ofSven = expectStatus(await bookAppointment(sven, south, { startsAt }), 201).body.id;

    const seenByPaul = await eventually(async () => idsOf(await listedBy(paul), ofPaul));
    const seenBySven = await eventually(async () => idsOf(await listedBy(sven), ofSven));

    expect(seenByPaul).toEqual([ofPaul]);
    expect(seenBySven).toEqual([ofSven]);
    expectStatus(await sven.get('/appointments/' + ofPaul), 403);
  });

  it('refuses at the edge a request that names a network its caller does not belong to', async () => {
    const asking = (network: string) => paul.withHeaders({ 'x-tenant-id': network }).get('/appointments');

    expectStatus(await asking(NETWORK), 200);
    expectProblem(await asking(OTHER_NETWORK), { status: 403, code: 'FORBIDDEN' });
    expectStatus(await asking('north,south'), 404);
  });
});

describe('Platform staff, who belong to no network', () => {
  it('read the trail of one network through an elevation the trail recorded first', async () => {
    // The trail is append-only, a reset keeps it: the entries of this test are found by the correlations it gave.
    const refused = randomUUID();
    const searched = randomUUID();
    const ops = await application.as({ id: 'ops', roles: ['platform-admin'], tenantId: null });

    expectStatus(await paul.withHeaders({ 'x-correlation-id': refused }).post('/practices', opening), 403);

    const read = await ops
      .withHeaders({ 'x-correlation-id': searched })
      .get<Listed<AuditLine>>('/audit/entries?outcome=denied&network=' + NETWORK + '&correlationId=' + refused);

    const elevations = await ops.get<Listed<AuditLine>>(
      '/audit/entries?action=tenancy:elevate&correlationId=' + searched,
    );

    expect(expectStatus(read, 200).body.items.map(({ action, tenantId }) => ({ action, tenantId }))).toEqual([
      { action: 'http:openPractice', tenantId: NETWORK },
    ]);

    expect(expectStatus(elevations, 200).body.items).toMatchObject([
      { action: 'tenancy:elevate', reason: 'AUDIT_TRAIL_SEARCH', actorId: 'ops', resourceId: NETWORK },
    ]);
  });

  it('read nothing of a network when the trail is searched for another one', async () => {
    const refused = randomUUID();
    const ops = await application.as({ id: 'ops', roles: ['platform-admin'], tenantId: null });

    expectStatus(await paul.withHeaders({ 'x-correlation-id': refused }).post('/practices', opening), 403);

    const read = await ops.get<Listed<AuditLine>>(
      '/audit/entries?network=' + OTHER_NETWORK + '&correlationId=' + refused,
    );

    expect(expectStatus(read, 200).body.items).toEqual([]);
  });
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };
const hillside = { name: 'Hillside', managerId: 'marie', practitionerId: 'pierre', assistantId: 'irene' };
const opening = { name: 'Lakeside', timeZone: 'Europe/Paris', managerId: 'paul' };

async function listedBy(patient: HttpClient): Promise<readonly Identified[]> {
  return expectStatus(await patient.get<Listed<Identified>>('/appointments'), 200).body.items;
}

/** The ids listed, once the one expected is among them: the list is a read model, fed after the booking. */
function idsOf(items: readonly Identified[], expected: string): readonly string[] {
  const ids = items.map((item) => item.id);

  if (!ids.includes(expected)) {
    throw new Error('The appointment ' + expected + ' is not listed yet.');
  }

  return ids;
}
