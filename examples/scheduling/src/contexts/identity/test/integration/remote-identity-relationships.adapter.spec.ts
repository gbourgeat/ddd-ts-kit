import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { RemoteIdentityRelationships } from '../../infrastructure/external/remote-identity-relationships.adapter.js';
import { createTupleStore } from '../../../../platform/auth/create-tuple-store.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';

const delegation = { practiceId: 'practice-1', practitionerId: 'grace', assistantId: 'linus' };
let database: TestDatabase;
let tuples: RelationTupleStore;
let relationships: RemoteIdentityRelationships;

beforeAll(async () => {
  database = await openTestDatabase();
  // The store of the platform: it refuses a tuple the relationship schema does not know.
  tuples = createTupleStore(database.persistence.database);
  relationships = new RemoteIdentityRelationships(tuples);
});

beforeEach(async () => {
  await database.reset();
});

afterAll(async () => {
  await database.close();
});

describe('RemoteIdentityRelationships', () => {
  it('writes that a person is themselves', async () => {
    await relationships.recordPerson('ada');

    expect(await subjectsOf('person:ada', 'self')).toEqual(['user:ada']);
  });

  it.each(['manager', 'assistant'])('writes the role of a %s on the practice, and no desk', async (role) => {
    await relationships.recordMembership({ practiceId: 'practice-1', personId: 'ada', role });

    expect(await subjectsOf('practice:practice-1', role)).toEqual(['user:ada']);
    expect(await subjectsOf('desk:practice-1.ada', 'holder')).toEqual([]);
  });

  it('writes the role of a practitioner, the desk they hold and the practice of that desk', async () => {
    await relationships.recordMembership({ practiceId: 'practice-1', personId: 'grace', role: 'practitioner' });

    expect(await subjectsOf('practice:practice-1', 'practitioner')).toEqual(['user:grace']);
    expect(await subjectsOf('desk:practice-1.grace', 'holder')).toEqual(['user:grace']);
    expect(await subjectsOf('desk:practice-1.grace', 'practice')).toEqual(['practice:practice-1']);
  });

  it('removes the role and the desk when the membership of a practitioner is forgotten, and keeps the other members', async () => {
    await relationships.recordMembership({ practiceId: 'practice-1', personId: 'grace', role: 'practitioner' });
    await relationships.recordMembership({ practiceId: 'practice-1', personId: 'ada', role: 'manager' });

    await relationships.forgetMembership({ practiceId: 'practice-1', personId: 'grace', role: 'practitioner' });

    expect(await subjectsOf('practice:practice-1', 'practitioner')).toEqual([]);
    expect(await subjectsOf('desk:practice-1.grace', 'holder')).toEqual([]);
    expect(await subjectsOf('desk:practice-1.grace', 'practice')).toEqual([]);
    expect(await subjectsOf('practice:practice-1', 'manager')).toEqual(['user:ada']);
  });

  it('writes the delegate of a desk, without the availability when the delegation leaves it out', async () => {
    await relationships.recordDelegation({ ...delegation, availabilityIncluded: false });

    expect(await subjectsOf('desk:practice-1.grace', 'delegate')).toEqual(['user:linus']);
    expect(await subjectsOf('desk:practice-1.grace', 'availability_delegate')).toEqual([]);
  });

  it('writes the delegate of the availability too when the delegation includes it', async () => {
    await relationships.recordDelegation({ ...delegation, availabilityIncluded: true });

    expect(await subjectsOf('desk:practice-1.grace', 'delegate')).toEqual(['user:linus']);
    expect(await subjectsOf('desk:practice-1.grace', 'availability_delegate')).toEqual(['user:linus']);
  });

  it('removes both when the delegation is forgotten', async () => {
    await relationships.recordDelegation({ ...delegation, availabilityIncluded: true });

    await relationships.forgetDelegation(delegation);

    expect(await subjectsOf('desk:practice-1.grace', 'delegate')).toEqual([]);
    expect(await subjectsOf('desk:practice-1.grace', 'availability_delegate')).toEqual([]);
  });

  it('changes nothing when a fact is recorded twice or forgotten before it was known', async () => {
    await relationships.recordPerson('ada');
    await relationships.recordPerson('ada');
    await relationships.forgetDelegation(delegation);

    expect(await subjectsOf('person:ada', 'self')).toEqual(['user:ada']);
  });

  it('writes in the unit of work of the command: what a failed command recorded is not kept', async () => {
    const failing = database.persistence.unitOfWork.run(async () => {
      await relationships.recordPerson('ada');

      throw new Error('the command failed after recording');
    });

    await expect(failing).rejects.toThrow('the command failed after recording');
    expect(await subjectsOf('person:ada', 'self')).toEqual([]);
  });
});

async function subjectsOf(object: string, relation: string): Promise<readonly string[]> {
  return (await tuples.readByObject(object, relation)).map((tuple) => tuple.subject);
}
