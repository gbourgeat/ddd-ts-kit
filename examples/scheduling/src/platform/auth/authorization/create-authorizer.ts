import type { Authorizer } from '@ddd-ts-kit/auth';
import { RelationBasedAuthorizer, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { relationshipSchema } from '@/platform/auth/relationships/relationship-schema';
import { roleGrants } from '@/platform/auth/authorization/role-grants';
import { RolesAndRelationshipsAuthorizer } from '@/platform/auth/authorization/roles-and-relationships.authorizer';

/** A role of the token first (`role-grants.ts`); else relationships: is there a path of stored tuples from this element to the actor? */
export function createAuthorizer(store: RelationTupleStore): Authorizer {
  const relationships = new RelationBasedAuthorizer({ schema: relationshipSchema, store });

  return new RolesAndRelationshipsAuthorizer(relationships, roleGrants);
}
