import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Notification } from '../../domain/aggregates/notification.aggregate.js';
import { KnexNotificationRepository } from '../../infrastructure/persistence/knex-notification.repository.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import { aNotification } from '../builders/notification.builder.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aNotification().build(),
  // A notification is born sent and never changes: the suite saves it again as it is.
  mutate: () => undefined,
  idOf: (subject: Notification) => subject.id,
  stateOf: (subject: Notification) => subject.toState(),
};

repositoryContract<Notification>(runner, {
  ...expectations,
  name: 'FakeNotificationRepository',
  createRepository: () => new FakeNotificationRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Notification>(runner, {
  ...expectations,
  name: 'KnexNotificationRepository',
  createRepository: createKnexRepository,
});

describe.each([
  ['FakeNotificationRepository', async () => new FakeNotificationRepository()],
  ['KnexNotificationRepository', createKnexRepository],
] as const)('%s, by cause', (_name, createRepository) => {
  it('finds the notification sent to a recipient for a cause, with everything it told', async () => {
    const repository = await createRepository();

    const sent = aNotification()
      .sentTo('patient-1')
      .ofKind('rescheduling')
      .about('appointment-4', new Date('2026-03-05T14:30:00.000Z'))
      .causedBy('event-1')
      .build();

    await repository.save(sent);
    const found = await repository.findByCause('event-1', 'patient-1');

    expect(found?.id).toBe(sent.id);
    expect(found?.toState()).toEqual(sent.toState());
  });

  it('finds nothing for another recipient or another cause', async () => {
    const repository = await createRepository();

    await repository.save(aNotification().sentTo('patient-1').causedBy('event-1').build());

    expect(await repository.findByCause('event-1', 'patient-2')).toBeUndefined();
    expect(await repository.findByCause('event-2', 'patient-1')).toBeUndefined();
  });
});

async function createKnexRepository(): Promise<KnexNotificationRepository> {
  await database.reset();

  return new KnexNotificationRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
}

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
