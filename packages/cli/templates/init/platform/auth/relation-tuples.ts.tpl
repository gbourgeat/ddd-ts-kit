import { SchemaCheckedTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { createTupleStore } from '{{alias.platform}}/auth/create-tuple-store.js';
import { relationshipSchema } from '{{alias.platform}}/auth/relationship-schema.js';

/** The relationships the authorizer reads: a tuple that the schema does not know is refused when it is written. */
export const relationTuples: RelationTupleStore = new SchemaCheckedTupleStore(relationshipSchema, createTupleStore());
