import { SchemaCheckedTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { createTupleStore } from '{{alias.platform}}/auth/relationships/create-tuple-store{{alias.ext}}';
import { relationshipSchema } from '{{alias.platform}}/auth/relationships/relationship-schema{{alias.ext}}';

/** The relationships the authorizer reads: a tuple that the schema does not know is refused when it is written. */
export const relationTuples: RelationTupleStore = new SchemaCheckedTupleStore(relationshipSchema, createTupleStore());
