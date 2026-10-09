import type { Authorizer } from '@ddd-ts-kit/auth';
import { RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';
import { RELATIONSHIP_SCHEMA, permissionMapping, relationTuples } from './relationships.js';

/** Relationships: is there a path of stored tuples from this element to the actor? */
export function createAuthorizer(): Authorizer {
  return new RelationBasedAuthorizer({ schema: RELATIONSHIP_SCHEMA, store: relationTuples, mapping: permissionMapping() });
}
