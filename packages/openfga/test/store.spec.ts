import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { OpenFgaRelationTupleStore } from '../src/index.js';
import { schema } from './support/documents.js';
import { InMemoryOpenFga } from './support/in-memory-open-fga.js';

const runner = { describe, it, expect, beforeEach, afterEach };

relationTupleStoreContract(runner, {
  name: 'OpenFgaRelationTupleStore, on the tuple endpoints in memory',
  create: () => new OpenFgaRelationTupleStore(new InMemoryOpenFga(), schema),
});

describe('OpenFgaRelationTupleStore', () => {
  it('reads every page, and writes and deletes in chunks the API accepts', async () => {
    const client = new InMemoryOpenFga();
    const store = new OpenFgaRelationTupleStore(client, schema);

    const many = Array.from({ length: 230 }, (_, index) => ({
      object: 'document:1',
      relation: 'viewer',
      subject: `user:u${String(index).padStart(3, '0')}`,
    }));

    await store.write(many);

    expect(await store.readByObject('document:1', 'viewer')).toHaveLength(230);
    expect(await store.readBySubject('user:u007')).toEqual([many[7]]);

    await store.delete(many.slice(0, 120));

    expect(await store.readByObject('document:1', 'viewer')).toHaveLength(110);
  });
});
