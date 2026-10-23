import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract, tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import type { Appointment } from '@/contexts/scheduling/domain/calendars/aggregates/appointment.aggregate';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { Cancellation } from '@/contexts/scheduling/domain/calendars/value-objects/cancellation.vo';
import { KnexAppointmentRepository } from '@/contexts/scheduling/infrastructure/persistence/knex-appointment.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { anAttachedDocument } from '@/contexts/scheduling/test/builders/attached-document.builder';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => anAppointment().build(),
  mutate: (changed: Appointment) => {
    changed.cancel(Cancellation.create('practice', 'The practitioner is away.'), new Date('2026-01-02T00:00:00.000Z'));

    // The reference of a stored file round trips with the row: never its content.
    changed.attachDocument(anAttachedDocument(), new Date('2026-01-02T00:00:00.000Z'));
  },
  idOf: (subject: Appointment) => subject.id,
  stateOf: (subject: Appointment) => subject.toState(),
};

repositoryContract<Appointment>(runner, {
  ...expectations,
  name: 'FakeAppointmentRepository',
  createRepository: () => new FakeAppointmentRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Appointment>(runner, {
  ...expectations,
  name: 'KnexAppointmentRepository',
  createRepository: knexRepository,
});

const REPOSITORIES: readonly (readonly [string, () => Promise<AppointmentRepository>])[] = [
  ['FakeAppointmentRepository', async () => new FakeAppointmentRepository()],
  ['KnexAppointmentRepository', knexRepository],
];

describe.each(REPOSITORIES)('%s (what a calendar holds)', (_name, create) => {
  it('stores every fact of a requested appointment, buffer and deadline included', async () => {
    const repository = await create();

    const requested = anAppointment()
      .startingAt(at('09:00'))
      .lasting(30)
      .withBuffer(10)
      .requestedUntil(at('08:00'))
      .onDay('2026-03-02')
      .build();

    await repository.save(requested);

    const found = await repository.findById(requested.id);

    expect(found?.status).toBe('requested');
    expect(found?.confirmBefore).toEqual(at('08:00'));
    expect(found?.booking.equals(requested.booking)).toBe(true);
    expect(found?.slot.heldUntil).toEqual(at('09:40'));
  });

  it('stores who cancelled an appointment and why', async () => {
    const repository = await create();
    const cancelled = anAppointment().cancelledByPractice().build();

    await repository.save(cancelled);

    const found = await repository.findById(cancelled.id);

    expect(found?.status).toBe('cancelled');

    expect(found?.cancellation?.equals(Cancellation.create('practice', 'The practitioner is away.'))).toBe(true);
  });

  it('refuses a second active appointment on a held time of the same calendar, buffer included', async () => {
    const repository = await create();

    await repository.save(
      anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).lasting(30).withBuffer(10).build(),
    );

    const second = repository.save(anAppointment().onCalendar('calendar-a').startingAt(at('09:35')).build());

    await expect(second).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
  });

  it('accepts an appointment that starts when the previous one stops holding, and the same time on another calendar', async () => {
    const repository = await create();

    await repository.save(
      anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).lasting(30).withBuffer(10).build(),
    );

    await repository.save(anAppointment().onCalendar('calendar-a').startingAt(at('09:40')).build());
    await repository.save(anAppointment().onCalendar('calendar-b').startingAt(at('09:00')).build());

    expect(await repository.heldOn('calendar-a', at('09:00'), at('10:00'))).toHaveLength(2);
  });

  it('gives back the time of an appointment that ended', async () => {
    const repository = await create();

    await repository.save(
      anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).cancelledByPatient().build(),
    );

    await repository.save(anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).expired().build());

    await repository.save(anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).build());

    expect(await repository.heldOn('calendar-a', at('09:00'), at('09:30'))).toHaveLength(1);
  });

  it('refuses to move an appointment onto a held time', async () => {
    const repository = await create();
    const morning = anAppointment().onCalendar('calendar-a').startingAt(at('09:00')).build();
    const noon = anAppointment().onCalendar('calendar-a').startingAt(at('12:00')).build();

    await repository.save(morning);
    await repository.save(noon);

    noon.reschedule(morning.slot, '2026-03-02', at('08:00'));

    await expect(repository.save(noon)).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
  });
});

describe.each(REPOSITORIES)('%s (what it finds among the appointments)', (_name, create) => {
  it('finds the active appointments of a calendar that hold an instant of a span', async () => {
    const repository = await create();
    const before = anAppointment().onCalendar('calendar-a').startingAt(at('08:00')).lasting(30).build();

    const buffered = anAppointment()
      .onCalendar('calendar-a')
      .startingAt(at('08:30'))
      .lasting(25)
      .withBuffer(10)
      .build();

    const inside = anAppointment().onCalendar('calendar-a').startingAt(at('09:30')).build();
    const after = anAppointment().onCalendar('calendar-a').startingAt(at('10:00')).build();
    const elsewhere = anAppointment().onCalendar('calendar-b').startingAt(at('09:30')).build();

    const ended = anAppointment()
      .onCalendar('calendar-a')
      .startingAt(at('09:05'))
      .lasting(20)
      .cancelledByPatient()
      .build();

    await saveAll(repository, [before, buffered, inside, after, elsewhere, ended]);

    const held = await repository.heldOn('calendar-a', at('09:00'), at('10:00'));

    expect(held.map((appointment) => appointment.id)).toEqual([buffered.id, inside.id]);
  });

  it('finds the appointments a patient still holds with a practitioner, whatever the calendar', async () => {
    const repository = await create();

    const coming = visit('patient-a', 'practitioner-a', '09:00').build();
    const elsewhere = visit('patient-a', 'practitioner-a', '11:00').build();
    const started = visit('patient-a', 'practitioner-a', '07:00').build();
    const cancelled = visit('patient-a', 'practitioner-a', '13:00').cancelledByPatient().build();
    const other = visit('patient-a', 'practitioner-b', '09:00').build();
    const someone = visit('patient-b', 'practitioner-a', '09:00').build();

    await saveAll(repository, [coming, elsewhere, started, cancelled, other, someone]);

    const held = await repository.heldBy('patient-a', 'practitioner-a', at('08:00'));

    expect(held.map((appointment) => appointment.id)).toEqual([coming.id, elsewhere.id]);
  });

  it('finds the requested appointments whose deadline has come', async () => {
    const repository = await create();
    const due = anAppointment().requestedUntil(at('08:00')).build();
    const dueNow = anAppointment().requestedUntil(at('08:30')).build();
    const later = anAppointment().requestedUntil(at('08:31')).build();
    const booked = anAppointment().build();
    const expired = anAppointment().requestedUntil(at('07:00')).expired().build();

    await saveAll(repository, [due, dueNow, later, booked, expired]);

    const unconfirmed = await repository.unconfirmedAt(at('08:30'));

    expect(unconfirmed.map((appointment) => appointment.id)).toEqual([due.id, dueNow.id]);
  });
});

function visit(patientId: string, practitionerId: string, time: string) {
  return anAppointment().forPatient(patientId).withPractitioner(practitionerId).startingAt(at(time));
}

async function saveAll(repository: AppointmentRepository, appointments: readonly Appointment[]): Promise<void> {
  await appointments.reduce((saved, appointment) => saved.then(() => repository.save(appointment)), Promise.resolve());
}

async function knexRepository(): Promise<AppointmentRepository> {
  await database.reset();

  return new KnexAppointmentRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
}

/** No read and no write of one network reaches another, whatever the work in progress asks. */
tenantIsolationContract<Appointment>(runner, {
  ...expectations,
  name: 'KnexAppointmentRepository',
  createRepository: async (scope) => {
    await database.reset();

    return new KnexAppointmentRepository(database.persistence.database, scope, clock);
  },
  recreate: (appointment: Appointment) => anAppointment().identifiedBy(appointment.id).build(),
  elevatedReads: true,
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
