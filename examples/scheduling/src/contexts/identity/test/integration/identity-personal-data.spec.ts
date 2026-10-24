import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { KnexIdentityPersonalDataErasure } from '@/contexts/identity/infrastructure/persistence/knex-identity-personal-data-erasure.repository';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const acme = new FixedExecutionScope(workOf('acme'));
const north = new FixedExecutionScope(workOf('north'));

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
});

describe('KnexIdentityPersonalDataErasure, the right to erasure', () => {
  it('forgets the person, name and address included, and reaches nothing the second time', async () => {
    const persons = new KnexPersonRepository(database.persistence.database, acme, clock);
    const erasure = new KnexIdentityPersonalDataErasure(database.persistence.database, acme);

    await persons.save(aPerson().identifiedBy('ada').build());
    await persons.save(aPerson().identifiedBy('bob').build());

    expect(await erasure.erase('ada')).toBe(1);
    expect(await persons.findById('ada')).toBeUndefined();
    expect(await persons.findById('bob')).toBeDefined();
    expect(await erasure.erase('ada')).toBe(0);
  });

  it('forgets a person of its own network alone: asked from another network, it reaches nothing', async () => {
    const persons = new KnexPersonRepository(database.persistence.database, acme, clock);

    await persons.save(aPerson().identifiedBy('ada').build());

    expect(await new KnexIdentityPersonalDataErasure(database.persistence.database, north).erase('ada')).toBe(0);
    expect(await persons.findById('ada')).toBeDefined();
    expect(await new KnexIdentityPersonalDataErasure(database.persistence.database, acme).erase('ada')).toBe(1);
  });

  it('is named as the report of an erasure names the copy', () => {
    expect(new KnexIdentityPersonalDataErasure(database.persistence.database, acme).name).toBe('identity');
  });
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'personal-data-spec', actor, origin: 'test' });
}
