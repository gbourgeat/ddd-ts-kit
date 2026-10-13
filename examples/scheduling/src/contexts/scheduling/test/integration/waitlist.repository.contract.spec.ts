import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Waitlist } from '@/contexts/scheduling/domain/aggregates/waitlist.aggregate';
import { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo';
import { KnexWaitlistRepository } from '@/contexts/scheduling/infrastructure/persistence/knex-waitlist.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aWaitlist } from '@/contexts/scheduling/test/builders/waitlist.builder';
import { FakeWaitlistRepository } from '@/contexts/scheduling/test/fakes/waitlist.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aWaitlist().joinedBy('patient-1').joinedBy('patient-2', 'surgery').build(),
  mutate: (changed: Waitlist) => {
    changed.join(
      Waiter.create({
        patientId: 'patient-9',
        appointmentTypeId: 'consultation',
        joinedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      new Date('2026-01-02T00:00:00.000Z'),
    );
  },
  idOf: (subject: Waitlist) => subject.id,
  stateOf: (subject: Waitlist) => subject.toState(),
};

repositoryContract<Waitlist>(runner, {
  ...expectations,
  name: 'FakeWaitlistRepository',
  createRepository: () => new FakeWaitlistRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Waitlist>(runner, {
  ...expectations,
  name: 'KnexWaitlistRepository',
  createRepository: async () => {
    await database.reset();

    return new KnexWaitlistRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
