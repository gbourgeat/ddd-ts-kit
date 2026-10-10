import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { KnexPersonDirectory } from '../../infrastructure/persistence/knex-person-directory.reader.js';
import { KnexPersonRepository } from '../../infrastructure/persistence/knex-person.repository.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import { aPerson } from '../builders/person.builder.js';

const actor: Actor = { id: 'registrar', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'directory-spec', actor, origin: 'test' }));
let database: TestDatabase;
let directory: KnexPersonDirectory;

beforeAll(async () => {
  database = await openTestDatabase();
  directory = new KnexPersonDirectory(database.persistence.database);
});

beforeEach(async () => {
  await database.reset();

  const persons = new KnexPersonRepository(
    database.persistence.database,
    scope,
    new FixedClock(new Date('2026-01-01T00:00:00.000Z')),
  );

  await persons.save(aPerson().identifiedBy('ada').named('Ada Lovelace').build());
  await persons.save(aPerson().identifiedBy('grace').named('Grace Hopper').build());
  await persons.save(aPerson().identifiedBy('linus').named('Linus Pauling').build());
});

afterAll(async () => {
  await database.close();
});

describe('KnexPersonDirectory', () => {
  it('answers the name to display of each person asked for, and nothing else about them', async () => {
    const cards = await directory.byIds(['grace', 'ada']);

    expect(cards).toEqual([
      { personId: 'ada', displayName: 'Ada Lovelace' },
      { personId: 'grace', displayName: 'Grace Hopper' },
    ]);
  });

  it('leaves out an identifier nobody is registered under', async () => {
    const cards = await directory.byIds(['ada', 'stranger']);

    expect(cards).toEqual([{ personId: 'ada', displayName: 'Ada Lovelace' }]);
  });

  it('answers a person once when their identifier is asked twice', async () => {
    const cards = await directory.byIds(['ada', 'ada']);

    expect(cards).toHaveLength(1);
  });

  it('answers nobody when no identifier is asked', async () => {
    const cards = await directory.byIds([]);

    expect(cards).toEqual([]);
  });
});
