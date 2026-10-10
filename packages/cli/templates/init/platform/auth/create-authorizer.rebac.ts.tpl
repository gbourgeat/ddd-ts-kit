import type { Authorizer } from '@ddd-ts-kit/auth';
import { RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';
import { permissionMapping } from './permission-mapping.js';
import { relationTuples } from './relation-tuples.js';
import { relationshipSchema } from './relationship-schema.js';

/** Relationships: is there a path of stored tuples from this element to the actor? */
export function createAuthorizer(): Authorizer {
  return new RelationBasedAuthorizer({
    schema: relationshipSchema,
    store: relationTuples,
    mapping: permissionMapping(),
  });
}
