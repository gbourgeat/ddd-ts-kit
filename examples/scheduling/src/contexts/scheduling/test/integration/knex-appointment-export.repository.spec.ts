import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, FixedExecutionScope, executionContext, systemActor } from '@ddd-ts-kit/kernel';
import type { Appointment } from '#src/contexts/scheduling/domain/aggregates/appointment.aggregate.js';
import { KnexAppointmentExport } from '#src/contexts/scheduling/infrastructure/persistence/knex-appointment-export.repository.js';
import { KnexAppointmentRepository } from '#src/contexts/scheduling/infrastructure/persistence/knex-appointment.repository.js';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import { anAppointment } from '#src/contexts/scheduling/test/builders/appointment.builder.js';

const scope = new FixedExecutionScope(
  executionContext({ correlationId: 'export-spec', actor: systemActor('scheduling.spec'), origin: 'test' }),
);

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const bornAt = new Date('2026-03-01T08:00:00.000Z');

let database: TestDatabase;
let exported: KnexAppointmentExport;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  exported = new KnexAppointmentExport(database.persistence.database);
});

describe('KnexAppointmentExport', () => {
  it('states an appointment as it is now: what it holds without its buffer, its outcome, and when it last changed', async () => {
    await store(planned('appointment-1').build());

    const page = await exported.export();

    expect(page).toEqual({
      appointments: [
        {
          appointmentId: 'appointment-1',
          calendarId: 'calendar-of-appointment-1',
          practiceId: 'practice-2',
          startsAt: '2026-03-02T23:30:00.000Z',
          endsAt: '2026-03-03T00:00:00.000Z',
          day: '2026-03-03',
          outcome: 'held',
          changedAt: '2026-03-01T08:00:00.000Z',
        },
      ],
    });
  });

  it.each([
    ['held', planned('appointment-1').requestedUntil(new Date('2026-03-01T12:00:00.000Z'))],
    ['cancelled-by-patient', planned('appointment-1').cancelledByPatient()],
    ['cancelled-by-practice', planned('appointment-1').cancelledByPractice()],
    ['expired', planned('appointment-1').expired()],
    ['completed', planned('appointment-1').completed()],
    ['no-show', planned('appointment-1').markedNoShow()],
  ])('states the outcome %s', async (outcome, builder) => {
    await store(builder.build());

    const [stated] = await exported.lookup(['appointment-1']);

    expect(stated?.outcome).toBe(outcome);
  });

  it('dates an appointment at its last fact', async () => {
    const appointment = planned('appointment-1').build();

    appointment.complete(new Date('2026-03-03T00:05:00.000Z'));
    await store(appointment);

    const [stated] = await exported.lookup(['appointment-1']);

    expect(stated?.changedAt).toBe('2026-03-03T00:05:00.000Z');
  });

  it('looks up the appointments asked for, leaving out an unknown identifier', async () => {
    await store(planned('appointment-1').build(), planned('appointment-2').build(), planned('appointment-3').build());

    const stated = await exported.lookup(['appointment-3', 'appointment-unknown', 'appointment-1']);

    expect(stated.map((appointment) => appointment.appointmentId)).toEqual(['appointment-1', 'appointment-3']);
    expect(await exported.lookup([])).toEqual([]);
  });

  it('exports every appointment once, page by page in a stable order, the last page without a cursor', async () => {
    const ids = Array.from({ length: 205 }, (_unused, index) => 'appointment-' + String(index).padStart(3, '0'));

    await store(...ids.map((id) => planned(id).build()));

    const first = await exported.export();
    const second = await exported.export(first.nextCursor);
    const third = await exported.export(second.nextCursor);

    expect([first, second, third].map((page) => page.appointments.length)).toEqual([100, 100, 5]);

    expect(
      [...first.appointments, ...second.appointments, ...third.appointments].map(
        (appointment) => appointment.appointmentId,
      ),
    ).toEqual(ids);

    expect(third.nextCursor).toBeUndefined();
  });

  it('exports nothing, without a cursor, when there is no appointment', async () => {
    expect(await exported.export()).toEqual({ appointments: [] });
  });
});

async function store(...appointments: readonly Appointment[]): Promise<void> {
  const repository = new KnexAppointmentRepository(database.persistence.database, scope, clock);

  await appointments.reduce((saved, appointment) => saved.then(() => repository.save(appointment)), Promise.resolve());
}

function planned(id: string) {
  return anAppointment()
    .identifiedBy(id)
    .bornAt(bornAt)
    .onCalendar('calendar-of-' + id)
    .inPractice('practice-2')
    .startingAt(new Date('2026-03-02T23:30:00.000Z'))
    .onDay('2026-03-03')
    .lasting(30)
    .withBuffer(10);
}
