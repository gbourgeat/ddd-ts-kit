import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import { AUTHORIZATION_SCHEMA } from '#src/platform/database/schema.js';
import { KnexRelationTupleStore } from '#src/platform/auth/knex-relation-tuple-store.js';

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(() => database.close());

// The contract writes tuples of a model of its own: the store is held to it bare, without the schema check of the platform.
relationTupleStoreContract(
  { describe, it, expect, beforeEach },
  {
    name: 'The relation tuple store of the platform',
    create: async () => {
      await database.reset();

      return new KnexRelationTupleStore(database.persistence.database, { schema: AUTHORIZATION_SCHEMA });
    },
  },
);
