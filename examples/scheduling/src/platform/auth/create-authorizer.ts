import type { Authorizer } from '@ddd-ts-kit/auth';
import { RelationBasedAuthorizer, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { permissionMapping } from '@/platform/auth/permission-mapping.js';
import { relationshipSchema } from '@/platform/auth/relationship-schema.js';
import { roleGrants } from '@/platform/auth/role-grants.js';
import { RolesAndRelationshipsAuthorizer } from '@/platform/auth/roles-and-relationships.authorizer.js';

/** A role of the token first (`role-grants.ts`); else relationships: is there a path of stored tuples from this element to the actor? */
export function createAuthorizer(store: RelationTupleStore): Authorizer {
  const relationships = new RelationBasedAuthorizer({
    schema: relationshipSchema,
    store,
    mapping: permissionMapping(),
  });

  return new RolesAndRelationshipsAuthorizer(relationships, roleGrants);
}
