import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Reminder } from '@/contexts/notification/domain/aggregates/reminder.aggregate';
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aReminder } from '@/contexts/notification/test/builders/reminder.builder';
import { FakeReminderRepository } from '@/contexts/notification/test/fakes/reminder.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aReminder().build(),
  mutate: (changed: Reminder) => {
    changed.withdraw();
  },
  idOf: (subject: Reminder) => subject.id,
  stateOf: (subject: Reminder) => subject.toState(),
};

repositoryContract<Reminder>(runner, {
  ...expectations,
  name: 'FakeReminderRepository',
  createRepository: () => new FakeReminderRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Reminder>(runner, {
  ...expectations,
  name: 'KnexReminderRepository',
  createRepository: createKnexRepository,
});

const startsAt = new Date('2026-03-10T09:00:00.000Z');
const dayBefore = new Date('2026-03-09T09:00:00.000Z');

describe.each([
  ['FakeReminderRepository', async () => new FakeReminderRepository()],
  ['KnexReminderRepository', createKnexRepository],
] as const)('%s, by appointment and by due instant', (_name, createRepository) => {
  it('finds the reminder of an appointment, in its stored state', async () => {
    const repository = await createRepository();
    const planned = aReminder().of('appointment-4').remindingOf('patient-9').plannedFor(startsAt).build();

    await repository.save(planned);
    const found = await repository.findByAppointment('appointment-4');

    expect(found?.id).toBe(planned.id);
    expect(found?.toState()).toEqual(planned.toState());
    expect(await repository.findByAppointment('appointment-5')).toBeUndefined();
  });

  it('answers as due the planned reminders within 24 hours of a start still to come, the earliest first', async () => {
    const repository = await createRepository();

    await repository.save(
      aReminder().identifiedBy('due-second').plannedFor(new Date('2026-03-10T08:00:00.000Z')).build(),
    );

    await repository.save(
      aReminder().identifiedBy('due-first').plannedFor(new Date('2026-03-09T12:00:00.000Z')).build(),
    );

    await repository.save(
      aReminder().identifiedBy('too-early').plannedFor(new Date('2026-03-10T09:00:00.001Z')).build(),
    );

    await repository.save(aReminder().identifiedBy('started').plannedFor(dayBefore).build());

    const due = await repository.findDue(dayBefore);

    expect(due.map((reminder) => reminder.id)).toEqual(['due-first', 'due-second']);
  });

  it('answers a reminder as due at the very instant 24 hours before its start', async () => {
    const repository = await createRepository();

    await repository.save(aReminder().identifiedBy('just-due').plannedFor(startsAt).build());

    expect((await repository.findDue(dayBefore)).map((reminder) => reminder.id)).toEqual(['just-due']);
  });

  it('answers neither a sent nor a withdrawn reminder as due', async () => {
    const repository = await createRepository();

    await repository.save(aReminder().plannedFor(startsAt).sent(dayBefore).build());
    await repository.save(aReminder().plannedFor(startsAt).withdrawn().build());

    expect(await repository.findDue(new Date('2026-03-09T10:00:00.000Z'))).toEqual([]);
  });
});

async function createKnexRepository(): Promise<KnexReminderRepository> {
  await database.reset();

  return new KnexReminderRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
}

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
