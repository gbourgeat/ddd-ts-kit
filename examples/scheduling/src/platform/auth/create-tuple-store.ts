import { SchemaCheckedTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import type { KnexContext } from '@ddd-ts-kit/knex';
import { AUTHORIZATION_SCHEMA } from '#src/platform/database/schema.js';
import { KnexRelationTupleStore } from '#src/platform/auth/knex-relation-tuple-store.js';
import { relationshipSchema } from '#src/platform/auth/relationship-schema.js';

/**
 * The relationships the authorizer reads and the adapters of the contexts write, over the
 * database of the unit of work: a tuple that the schema does not know is refused when it is written.
 */
export function createTupleStore(database: KnexContext): RelationTupleStore {
  return new SchemaCheckedTupleStore(
    relationshipSchema,
    new KnexRelationTupleStore(database, { schema: AUTHORIZATION_SCHEMA }),
  );
}
