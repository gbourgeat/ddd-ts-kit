import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient, type HttpResponse } from '@ddd-ts-kit/testing/e2e';
import { bookAppointment } from './support/book-appointment.js';
import type { Listed } from './support/listed.js';
import { openStaffedPractice } from './support/open-staffed-practice.js';
import { registerPeople } from './support/register-people.js';
import { slotStarting } from './support/slot-starting.js';
import type { StaffedPractice } from './support/staffed-practice.js';
import { startApplication, type RunningApplication } from './support/start-application.js';

interface Identified {
  readonly id: string;
}

interface CalendarDay {
  readonly busy: readonly { readonly startsAt: string; readonly appointment?: { readonly id: string; readonly patientId: string } }[];
}

interface AuditLine {
  readonly action: string;
  readonly outcome: string;
  readonly reason?: string;
  readonly actorId: string;
  readonly impersonatedBy?: string;
  readonly resourceId?: string;
}

const HOUR = 60 * 60_000;
const startsAt = slotStarting({ days: 7 });

let application: RunningApplication;
let practice: StaffedPractice;
let paul: HttpClient;
let rosa: HttpClient;
let grace: HttpClient;
let linus: HttpClient;

beforeAll(async () => {
  application = await startApplication();
});

afterAll(async () => {
  await application.close();
});

beforeEach(async () => {
  await application.reset();
  practice = await openStaffedPractice(application, riverside);
  await registerPeople(application, 'paul', 'rosa');
  paul = await application.as({ id: 'paul', roles: ['patient'] });
  rosa = await application.as({ id: 'rosa', roles: ['patient'] });
  grace = await application.as({ id: 'grace' });
  linus = await application.as({ id: 'linus' });
});

describe('The desk of a practitioner, delegated to an assistant', () => {
  it('refuses the assistant who books for a patient before the delegation, and lets them once it is granted', async () => {
    const before = await bookAppointment(linus, practice, { startsAt, patientId: 'paul' });

    await delegated({ availabilityIncluded: false });
    const after = await bookAppointment(linus, practice, { startsAt, patientId: 'paul' });

    expectProblem(before, { status: 403, code: 'FORBIDDEN' });
    expectStatus(after, 201);
  });

  it('keeps the opening hours from the delegate unless the delegation includes the availability', async () => {
    const openingHours = '/calendars/' + practice.calendarId + '/opening-hours';
    const withoutAvailability = await delegated({ availabilityIncluded: false });

    const refused = await linus.put(openingHours, mornings);

    expectStatus(await grace.delete(delegationsOfGrace() + '/' + withoutAvailability), 200);
    await delegated({ availabilityIncluded: true });
    const allowed = await linus.put(openingHours, mornings);

    expectProblem(refused, { status: 403, code: 'FORBIDDEN' });
    expectStatus(allowed, 200);
  });

  it('takes the desk back from the assistant when the delegation is revoked', async () => {
    const delegationId = await delegated({ availabilityIncluded: true });
    const appointmentId = expectStatus(await bookAppointment(linus, practice, { startsAt, patientId: 'paul' }), 201).body.id;

    expectStatus(await grace.delete(delegationsOfGrace() + '/' + delegationId), 200);
    const booking = await bookAppointment(linus, practice, { startsAt: new Date(startsAt.getTime() + HOUR), patientId: 'rosa' });
    const reading = await linus.get('/appointments/' + appointmentId);
    const planning = await linus.put('/calendars/' + practice.calendarId + '/opening-hours', mornings);

    expect([booking.status, reading.status, planning.status]).toEqual([403, 403, 403]);
  });
});

describe('What one practice and one patient hold, kept from the others', () => {
  it('refuses the agenda and the occupancy of a practice to the manager of another, and lists them none of its appointments', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const ada = await application.as({ id: riverside.managerId });

    await openStaffedPractice(application, hillside);
    const marie = await application.as({ id: hillside.managerId });
    const seenByItsManager = await eventually(async () => expectOne(await ada.get<Listed<Identified>>('/practices/' + practice.practiceId + '/agenda')));

    const agenda = await marie.get('/practices/' + practice.practiceId + '/agenda');
    const occupancy = await marie.get('/practices/' + practice.practiceId + '/occupancy');
    const appointments = await marie.get<Listed<Identified>>('/appointments');

    expect(seenByItsManager.id).toBe(appointmentId);
    expectProblem(agenda, { status: 403, code: 'FORBIDDEN' });
    expectProblem(occupancy, { status: 403, code: 'FORBIDDEN' });
    expect(expectStatus(appointments, 200).body).toMatchObject({ items: [], total: 0 });
  });

  it('refuses a patient the appointment of another, and shows them its slot as busy without the patient', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const day = await eventually(async () => expectStatus(await paul.get<{ day: string }>('/appointments/' + appointmentId), 200).body.day);
    const dayOfTheCalendar = '/calendars/' + practice.calendarId + '/days/' + day;

    const detail = await rosa.get('/appointments/' + appointmentId);
    const seenByAnother = expectStatus(await rosa.get<CalendarDay>(dayOfTheCalendar), 200).body;
    const seenByItsPatient = expectStatus(await paul.get<CalendarDay>(dayOfTheCalendar), 200).body;

    expectProblem(detail, { status: 403, code: 'FORBIDDEN' });
    expect(seenByAnother.busy).toEqual([expect.objectContaining({ startsAt: startsAt.toISOString() })]);
    expect(seenByAnother.busy[0]).not.toHaveProperty('appointment');
    expect(seenByItsPatient.busy[0]?.appointment).toMatchObject({ id: appointmentId, patientId: 'paul' });
  });
});

describe('An appointment that starts in less than a day', () => {
  it('is no longer the patient\'s to cancel or to move: the notice they owe the practice has run out', async () => {
    const appointmentId = expectStatus(await bookAppointment(grace, practice, { startsAt: slotStarting({ hours: 3 }), patientId: 'paul' }), 201).body.id;

    const cancellation = await paul.post('/appointments/' + appointmentId + '/cancellation', {});
    const move = await paul.post('/appointments/' + appointmentId + '/reschedule', { startsAt: startsAt.toISOString() });
    const detail = await eventually(async () => expectStatus(await paul.get<{ status: string }>('/appointments/' + appointmentId), 200));

    // The policy answers `scheduling.patient-cancels-until-notice`; the problem document of the kit carries the code and the permission, not that reason.
    expect(expectProblem(cancellation, { status: 403, code: 'FORBIDDEN' })['detail']).toContain('scheduling:appointment.cancel');
    expect(expectProblem(move, { status: 403, code: 'FORBIDDEN' })['detail']).toContain('scheduling:appointment.reschedule');
    expect(detail.body.status).toBe('booked');
  });

  it('is still the practitioner\'s to cancel, who must say why', async () => {
    const appointmentId = expectStatus(await bookAppointment(grace, practice, { startsAt: slotStarting({ hours: 3 }), patientId: 'paul' }), 201).body.id;

    const silent = await grace.post('/appointments/' + appointmentId + '/cancellation', {});
    const explained = await grace.post('/appointments/' + appointmentId + '/cancellation', { reason: 'The practitioner is away.' });
    const detail = await eventually(async () => expectCancelled(await paul.get<{ status: string; cancelledBy?: string }>('/appointments/' + appointmentId)));

    expectProblem(silent, { status: 422, code: 'REASON_REQUIRED' });
    expectStatus(explained, 201);
    expect(detail).toMatchObject({ status: 'cancelled', cancelledBy: 'practice' });
  });
});

describe('Support staff acting through a patient', () => {
  it('read what the patient reads and are refused every write', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const sam = await application.as({ id: 'paul', roles: ['patient'], impersonatedBy: 'sam' });

    const list = await eventually(async () => expectOne(await sam.get<Listed<Identified>>('/appointments')));
    const detail = await sam.get<Identified>('/appointments/' + appointmentId);

    const writes = [
      await sam.post('/appointments/' + appointmentId + '/cancellation', {}),
      await sam.post('/appointments/' + appointmentId + '/reschedule', { startsAt: new Date(startsAt.getTime() + HOUR).toISOString() }),
      await bookAppointment(sam, practice, { startsAt: new Date(startsAt.getTime() + 2 * HOUR) }),
      await sam.put('/people/me', { displayName: 'Somebody else', email: 'somebody@example.com' }),
    ];

    expect(list.id).toBe(appointmentId);
    expectStatus(detail, 200);
    expect(writes.map((write) => write.status)).toEqual([403, 403, 403, 403]);
    expect(expectStatus(await paul.get<{ status: string }>('/appointments/' + appointmentId), 200).body.status).toBe('booked');
  });

  it('leave their name in the audit trail, on what they were allowed and on what they were refused', async () => {
    const ofPaul = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const ofRosa = expectStatus(await bookAppointment(rosa, practice, { startsAt: new Date(startsAt.getTime() + HOUR) }), 201).body.id;
    // The trail is append-only, a reset keeps it: the entries of this session are found by the correlation the caller gave.
    const correlationId = randomUUID();
    const sam = (await application.as({ id: 'paul', roles: ['patient'], impersonatedBy: 'sam' })).withHeaders({ 'x-correlation-id': correlationId });
    const root = await application.as({ id: 'root', roles: ['platform-admin'] });

    expectStatus(await sam.post('/appointments/' + ofPaul + '/cancellation', {}), 403);
    expectStatus(await sam.get('/appointments/' + ofRosa), 403);
    const trail = expectStatus(await root.get<Listed<AuditLine>>('/audit/entries?sort=sequence&correlationId=' + correlationId), 200).body.items;
    const denied = expectStatus(await root.get<Listed<AuditLine>>('/audit/entries?outcome=denied&correlationId=' + correlationId), 200).body.items;

    expect(trail.map(summaryOf)).toEqual([
      { action: 'scheduling:appointment.cancel', outcome: 'allowed', actorId: 'paul', impersonatedBy: 'sam', resourceId: ofPaul },
      { action: 'CancelAppointmentCommand', outcome: 'failed', actorId: 'paul', impersonatedBy: 'sam', reason: 'FORBIDDEN' },
      { action: 'scheduling:appointment.read', outcome: 'denied', actorId: 'paul', impersonatedBy: 'sam', resourceId: ofRosa, reason: 'NO_RELATION' },
    ]);

    expect(denied.map((entry) => entry.action)).toEqual(['scheduling:appointment.read']);
  });
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };
const hillside = { name: 'Hillside', managerId: 'marie', practitionerId: 'pierre', assistantId: 'irene' };
const mornings = { ranges: [{ weekday: 'monday', start: '08:00', end: '12:00' }] };

/** What an entry says, without what changes from a run to the next. */
function summaryOf({ action, outcome, reason, actorId, impersonatedBy, resourceId }: AuditLine): Readonly<Record<string, string | undefined>> {
  return { action, outcome, actorId, impersonatedBy, resourceId, reason };
}

function delegationsOfGrace(): string {
  return '/practices/' + practice.practiceId + '/desks/' + practice.practitionerId + '/delegations';
}

/** The practitioner delegates their desk to the assistant of the practice; answers the identifier of the delegation. */
async function delegated(terms: { readonly availabilityIncluded: boolean }): Promise<string> {
  const granted = await grace.post<Identified>(delegationsOfGrace(), { assistantId: practice.assistantId, ...terms });

  return expectStatus(granted, 201).body.id;
}

/** The only line of a list, once the read model behind it shows one. */
function expectOne<Line>(response: HttpResponse<Listed<Line>>): Line {
  const [line, ...others] = expectStatus(response, 200).body.items;

  if (line === undefined || others.length > 0) throw new Error('Expected one line, found ' + String(others.length + (line === undefined ? 0 : 1)) + '.');

  return line;
}

function expectCancelled<Detail extends { readonly status: string }>(response: HttpResponse<Detail>): Detail {
  const detail = expectStatus(response, 200).body;

  expect(detail.status).toBe('cancelled');

  return detail;
}
