import type { RelationTuple, RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase, type TestDatabase } from '../database/open-test-database.js';
import { createTupleStore } from './create-tuple-store.js';

const docManages: RelationTuple = { object: 'practice:p1', relation: 'manager', subject: 'user:doc' };

describe('The relation tuple store of the platform, in a unit of work', () => {
  let database: TestDatabase;
  let store: RelationTupleStore;

  beforeAll(async () => {
    database = await openTestDatabase();
    store = createTupleStore(database.persistence.database);
  });

  beforeEach(() => database.reset());

  afterAll(() => database.close());

  it('stores the tuple when the unit of work commits', async () => {
    await database.persistence.unitOfWork.run(() => store.write([docManages]));

    expect(await store.readByObject('practice:p1', 'manager')).toEqual([docManages]);
  });

  it('shows the tuple to the work that wrote it, and stores nothing when that work rolls back', async () => {
    const failing = database.persistence.unitOfWork.run(async () => {
      await store.write([docManages]);

      expect(await store.readBySubject('user:doc')).toEqual([docManages]);

      throw new Error('the change this tuple describes failed');
    });

    await expect(failing).rejects.toThrow('the change this tuple describes failed');
    expect(await store.readByObject('practice:p1', 'manager')).toEqual([]);
  });

  it('refuses a tuple the relationship schema does not describe', async () => {
    await expect(store.write([{ object: 'practice:p1', relation: 'owner', subject: 'user:doc' }])).rejects.toThrow(
      'owner',
    );
  });
});
