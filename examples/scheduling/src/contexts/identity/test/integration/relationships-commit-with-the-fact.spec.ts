import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RelationTuple, RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import {
  FixedClock,
  FixedExecutionScope,
  InMemoryDomainEventDispatcher,
  dispatchingOnSave,
  executionContext,
  type Actor,
} from '@ddd-ts-kit/kernel';
import { PersonRegisteredEventHandler } from '@/contexts/identity/application/event-handlers/person-registered.event-handler.js';
import { PersonRegistered } from '@/contexts/identity/domain/events/person-registered.event.js';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository.js';
import { TupleIdentityRelationships } from '@/contexts/identity/infrastructure/persistence/tuple-identity-relationships.repository.js';
import { createTupleStore } from '@/platform/auth/create-tuple-store.js';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database.js';
import { aPerson } from '@/contexts/identity/test/builders/person.builder.js';

class DirectoryDown extends Error {}

const actor: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'relationships-spec', actor, origin: 'test' }));
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;
let tuples: RelationTupleStore;

beforeAll(async () => {
  database = await openTestDatabase();
  tuples = createTupleStore(database.persistence.database);
});

beforeEach(async () => {
  await database.reset();
});

afterAll(async () => {
  await database.close();
});

describe('The relationship of a person and the fact it follows', () => {
  it('commits with the person: written by the handler at the end of the unit of work, read by the authorizer afterwards', async () => {
    const { unitOfWork, people } = arrange();

    await unitOfWork.run(() => people.save(aPerson().identifiedBy('ada').build()));

    expect(await people.findById('ada')).toBeDefined();
    expect(await selfOf('ada')).toEqual([{ object: 'person:ada', relation: 'self', subject: 'user:ada' }]);
  });

  it('is never written when the unit of work fails after the save: the handler did not run', async () => {
    const { unitOfWork, people, handled } = arrange();

    const failing = unitOfWork.run(async () => {
      await people.save(aPerson().identifiedBy('ada').build());
      throw new DirectoryDown();
    });

    await expect(failing).rejects.toBeInstanceOf(DirectoryDown);
    expect(handled).toEqual([]);
    expect(await selfOf('ada')).toEqual([]);
  });

  it('is rolled back with the person when a handler fails after it was written', async () => {
    const { unitOfWork, people, domainEvents, handled } = arrange();

    domainEvents.on('identity.person.registered', () => Promise.reject(new DirectoryDown()));

    await expect(unitOfWork.run(() => people.save(aPerson().identifiedBy('ada').build()))).rejects.toBeInstanceOf(
      DirectoryDown,
    );

    expect(handled).toEqual(['ada']);
    expect(await people.findById('ada')).toBeUndefined();
    expect(await selfOf('ada')).toEqual([]);
  });
});

/** The repository and the handler of the context as the application wires them, on the database of the test. */
function arrange() {
  const { unitOfWork, database: context } = database.persistence;
  const domainEvents = new InMemoryDomainEventDispatcher();
  const handler = new PersonRegisteredEventHandler(new TupleIdentityRelationships(tuples));
  const handled: string[] = [];

  domainEvents.on('identity.person.registered', async (event) => {
    if (!(event instanceof PersonRegistered)) {
      return;
    }

    await handler.handle(event);
    handled.push(event.aggregateId);
  });

  return {
    unitOfWork,
    domainEvents,
    handled,
    people: dispatchingOnSave(new KnexPersonRepository(context, scope, clock), () => domainEvents),
  };
}

function selfOf(personId: string): Promise<readonly RelationTuple[]> {
  return tuples.readByObject('person:' + personId, 'self');
}
