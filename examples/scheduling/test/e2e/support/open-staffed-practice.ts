import { eventually, expectStatus } from '@ddd-ts-kit/testing/e2e';
import { registerPeople } from '$test/e2e/support/register-people.js';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice.js';
import type { RunningApplication } from '$test/e2e/support/start-application.js';

/** Who works in the practice: three registered people, one per role. */
export interface Staff {
  readonly name: string;
  readonly managerId: string;
  readonly practitionerId: string;
  readonly assistantId: string;
}

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const consultation = { name: 'Consultation', duration: 30, grid: 30, buffer: 0, needsConfirmation: false };

/**
 * A practice set up through the public API alone, by who may do each step: the platform admin
 * opens it, its manager adds a practitioner and an assistant, the practitioner creates a
 * calendar, opens it every day of the week around the clock and defines a consultation of
 * thirty minutes.
 */
export async function openStaffedPractice(application: RunningApplication, staff: Staff): Promise<StaffedPractice> {
  const { name, managerId, practitionerId, assistantId } = staff;

  await registerPeople(application, managerId, practitionerId, assistantId);

  const root = await application.as({ id: 'root', roles: ['platform-admin'] });

  const practiceId = expectStatus(
    await root.post<{ id: string }>('/practices', { name, timeZone: 'Europe/Paris', managerId }),
    201,
  ).body.id;

  const manager = await application.as({ id: managerId });

  expectStatus(
    await manager.post('/practices/' + practiceId + '/members', { personId: practitionerId, role: 'practitioner' }),
    201,
  );

  expectStatus(
    await manager.post('/practices/' + practiceId + '/members', { personId: assistantId, role: 'assistant' }),
    201,
  );

  return {
    practiceId,
    managerId,
    practitionerId,
    assistantId,
    ...(await openCalendar(application, practiceId, practitionerId)),
  };
}

async function openCalendar(
  application: RunningApplication,
  practiceId: string,
  practitionerId: string,
): Promise<Pick<StaffedPractice, 'calendarId' | 'appointmentTypeId'>> {
  const practitioner = await application.as({ id: practitionerId });

  // Scheduling learns its practitioners from the events of identity: the calendar is refused until the membership has arrived.
  const calendar = await eventually(async () =>
    expectStatus(await practitioner.post<{ id: string }>('/calendars', { practiceId, practitionerId }), 201),
  );

  const calendarId = calendar.body.id;
  const ranges = weekdays.map((weekday) => ({ weekday, start: '00:00', end: '24:00' }));

  expectStatus(await practitioner.put('/calendars/' + calendarId + '/opening-hours', { ranges }), 200);

  const type = expectStatus(
    await practitioner.post<{ id: string }>('/calendars/' + calendarId + '/appointment-types', consultation),
    201,
  );

  return { calendarId, appointmentTypeId: type.body.id };
}
