import { SchemaCheckedTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import type { KnexContext } from '@ddd-ts-kit/knex';
import { AUTHORIZATION_SCHEMA } from '@/platform/database/schema';
import { KnexRelationTupleStore } from '@/platform/auth/relationships/knex-relation-tuple-store';
import { relationshipSchema } from '@/platform/auth/relationships/relationship-schema';

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
