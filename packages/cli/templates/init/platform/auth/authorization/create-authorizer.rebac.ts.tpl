import type { Authorizer } from '@ddd-ts-kit/auth';
import { RelationBasedAuthorizer } from '@ddd-ts-kit/auth/rebac';
import { relationTuples } from '{{alias.platform}}/auth/relationships/relation-tuples{{alias.ext}}';
import { relationshipSchema } from '{{alias.platform}}/auth/relationships/relationship-schema{{alias.ext}}';

/** Relationships: is there a path of stored tuples from this element to the actor? `explain` says which, for debugging. */
export function createAuthorizer(): Authorizer {
  return new RelationBasedAuthorizer({ schema: relationshipSchema, store: relationTuples });
}
