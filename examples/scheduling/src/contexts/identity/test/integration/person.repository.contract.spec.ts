import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract, tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aPerson().build(),
  mutate: (changed: Person) => {
    changed.registerAgain({
      displayName: DisplayName.create('Renamed Person'),
      email: Email.create('renamed@example.com'),
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

/** No read and no write of one network reaches another, whatever the work in progress asks. */
tenantIsolationContract<Person>(runner, {
  ...expectations,
  name: 'KnexPersonRepository',
  createRepository: async (scope) => {
    await database.reset();

    return new KnexPersonRepository(database.persistence.database, scope, clock);
  },
  recreate: (person: Person) => aPerson().identifiedBy(person.id).build(),
  elevatedReads: true,
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}

describe('PersonRepository.erase, the right to erasure', () => {
  it.each([
    ['FakePersonRepository', async () => new FakePersonRepository()],
    [
      'KnexPersonRepository',
      async () => {
        await database.reset();

        return new KnexPersonRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
      },
    ],
  ])('%s forgets the person and answers whether there was one', async (_name, createRepository) => {
    const repository = await createRepository();

    await repository.save(aPerson().identifiedBy('ada').build());

    expect(await repository.erase('ada')).toBe(true);
    expect(await repository.findById('ada')).toBeUndefined();
    expect(await repository.erase('ada')).toBe(false);
  });

  it('on knex, forgets a person of its own network alone: asked from another network, it reaches nothing', async () => {
    await database.reset();

    const acme = new KnexPersonRepository(
      database.persistence.database,
      new FixedExecutionScope(workOf('acme')),
      clock,
    );

    const north = new KnexPersonRepository(
      database.persistence.database,
      new FixedExecutionScope(workOf('north')),
      clock,
    );

    await acme.save(aPerson().identifiedBy('ada').build());

    expect(await north.erase('ada')).toBe(false);
    expect(await acme.findById('ada')).toBeDefined();
    expect(await acme.erase('ada')).toBe(true);
  });
});
