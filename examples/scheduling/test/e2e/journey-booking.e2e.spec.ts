import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient, type HttpResponse } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { bookAppointment } from '$test/e2e/support/book-appointment.js';
import type { Listed } from '$test/e2e/support/listed.js';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice.js';
import { registerPeople } from '$test/e2e/support/register-people.js';
import { slotStarting } from '$test/e2e/support/slot-starting.js';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice.js';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application.js';

interface AppointmentLine {
  readonly id: string;
  readonly patientId: string;
  readonly day: string;
  readonly status: string;
  readonly startsAt: string;
  readonly cancelledBy?: string;
}

interface OccupancyLine {
  readonly calendarId: string;
  readonly day: string;
  readonly heldMinutes: number;
  readonly appointmentsHeld: number;
  readonly cancelledByPatient: number;
}

interface NotificationLine {
  readonly kind: string;
  readonly appointmentId: string;
  readonly startsAt: string;
}

describe('A patient books, is told, and cancels: the four contexts follow', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let rosa: HttpClient;
  const startsAt = slotStarting({ days: 7 });

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
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('gives the slot to the patient who books first and answers SLOT_TAKEN to the second', async () => {
    const first = await bookAppointment(paul, practice, { startsAt });
    const second = await bookAppointment(rosa, practice, { startsAt });

    expectStatus(first, 201);
    expectProblem(second, { status: 409, code: 'SLOT_TAKEN' });
  });

  it('lists the appointment to its patient, filtered and sorted, and not to another patient', async () => {
    const later = new Date(startsAt.getTime() + 2 * 60 * 60_000);
    const early = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const late = expectStatus(await bookAppointment(paul, practice, { startsAt: later }), 201).body.id;
    const held = '/appointments?filter[status]=booked&filter[calendarId]=' + practice.calendarId;

    const newestFirst = await eventually(async () =>
      idsOf(expectListed(await paul.get<Listed<AppointmentLine>>(held + '&sort=-startsAt'), 2)),
    );

    const fromTheLater = await paul.get<Listed<AppointmentLine>>(held + '&filter[startsAt]=gte:' + later.toISOString());
    const ofRosa = await rosa.get<Listed<AppointmentLine>>(held);

    expect(newestFirst).toEqual([late, early]);
    expect(idsOf(expectStatus(fromTheLater, 200).body)).toEqual([late]);
    expect(expectStatus(ofRosa, 200).body.items).toEqual([]);
  });

  it('tells the patient who booked, and nobody else', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;

    const told = await eventually(async () =>
      expectListed(await paul.get<Listed<NotificationLine>>('/notifications'), 1),
    );

    const ofRosa = await rosa.get<Listed<NotificationLine>>('/notifications');

    expect(told.items).toMatchObject([{ kind: 'confirmation', appointmentId, startsAt: startsAt.toISOString() }]);
    expect(expectStatus(ofRosa, 200).body.items).toEqual([]);
  });

  it('shows the minutes the practice holds to its manager', async () => {
    const manager = await application.as({ id: practice.managerId });

    expectStatus(await bookAppointment(paul, practice, { startsAt }), 201);
    expectStatus(await bookAppointment(rosa, practice, { startsAt: new Date(startsAt.getTime() + 30 * 60_000) }), 201);

    const occupancy = await eventually(async () =>
      expectHeld(await manager.get<Listed<OccupancyLine>>('/practices/' + practice.practiceId + '/occupancy'), 60),
    );

    expect(occupancy).toMatchObject({ calendarId: practice.calendarId, heldMinutes: 60, appointmentsHeld: 2 });
  });

  it('lets the patient cancel a week ahead: the list, the occupancy and the slot follow', async () => {
    const manager = await application.as({ id: practice.managerId });
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const occupancyOfThePractice = '/practices/' + practice.practiceId + '/occupancy';

    await eventually(async () => expectHeld(await manager.get<Listed<OccupancyLine>>(occupancyOfThePractice), 30));

    const cancellation = await paul.post('/appointments/' + appointmentId + '/cancellation', {});

    const freed = await eventually(async () =>
      expectHeld(await manager.get<Listed<OccupancyLine>>(occupancyOfThePractice), 0),
    );

    const listed = await eventually(async () =>
      expectListed(await paul.get<Listed<AppointmentLine>>('/appointments?filter[status]=cancelled'), 1),
    );

    const again = await bookAppointment(rosa, practice, { startsAt });

    expectStatus(cancellation, 201);
    expect(freed).toMatchObject({ heldMinutes: 0, appointmentsHeld: 0, cancelledByPatient: 1 });
    expect(listed.items).toMatchObject([{ id: appointmentId, status: 'cancelled', cancelledBy: 'patient' }]);
    expectStatus(again, 201);
  });
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };

function idsOf(page: Listed<{ readonly id: string }>): string[] {
  return page.items.map((item) => item.id);
}

/** The page, once it holds as many lines as the read model is expected to show. */
function expectListed<Line>(response: HttpResponse<Listed<Line>>, count: number): Listed<Line> {
  const page = expectStatus(response, 200).body;

  expect(page.items).toHaveLength(count);

  return page;
}

/** The one line of occupancy of the practice, once it counts these held minutes. */
function expectHeld(response: HttpResponse<Listed<OccupancyLine>>, minutes: number): OccupancyLine {
  const [line] = expectListed(response, 1).items;

  expect(line?.heldMinutes).toBe(minutes);

  if (line === undefined) {
    throw new Error('The practice has no line of occupancy.');
  }

  return line;
}
