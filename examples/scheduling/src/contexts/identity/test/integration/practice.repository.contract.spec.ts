import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';
import { Role } from '@/contexts/identity/domain/value-objects/role.vo';
import { KnexPracticeRepository } from '@/contexts/identity/infrastructure/persistence/knex-practice.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aPractice } from '@/contexts/identity/test/builders/practice.builder';
import { FakePracticeRepository } from '@/contexts/identity/test/fakes/practice.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aPractice().build(),
  mutate: (changed: Practice) => {
    changed.addMember(
      {
        personId: 'person-joining',
        role: Role.create('assistant'),
        displayName: DisplayName.create('Joining Person'),
      },
      new Date('2026-02-01T00:00:00.000Z'),
    );
  },
  idOf: (subject: Practice) => subject.id,
  stateOf: (subject: Practice) => subject.toState(),
};

repositoryContract<Practice>(runner, {
  ...expectations,
  name: 'FakePracticeRepository',
  createRepository: () => new FakePracticeRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Practice>(runner, {
  ...expectations,
  name: 'KnexPracticeRepository',
  createRepository: async () => {
    await database.reset();

    return new KnexPracticeRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
