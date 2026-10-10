import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  unwrap,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Person } from '#src/contexts/identity/domain/aggregates/person.aggregate.js';
import { DisplayName } from '#src/contexts/identity/domain/value-objects/display-name.vo.js';
import { Email } from '#src/contexts/identity/domain/value-objects/email.vo.js';
import { KnexPersonRepository } from '#src/contexts/identity/infrastructure/persistence/knex-person.repository.js';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import { aPerson } from '#src/contexts/identity/test/builders/person.builder.js';
import { FakePersonRepository } from '#src/contexts/identity/test/fakes/person.repository.fake.js';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aPerson().build(),
  mutate: (changed: Person) => {
    changed.registerAgain({
      displayName: unwrap(DisplayName.create('Renamed Person')),
      email: unwrap(Email.create('renamed@example.com')),
    });
  },
  idOf: (subject: Person) => subject.id,
  stateOf: (subject: Person) => subject.toState(),
};

repositoryContract<Person>(runner, {
  ...expectations,
  name: 'FakePersonRepository',
  createRepository: () => new FakePersonRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Person>(runner, {
  ...expectations,
  name: 'KnexPersonRepository',
  createRepository: async () => {
    await database.reset();

    return new KnexPersonRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}
