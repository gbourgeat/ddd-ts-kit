import { PolicyBasedAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';
import { SystemClock } from '@ddd-ts-kit/kernel';
import { attributePolicies } from '{{alias.platform}}/auth/attributes/attribute-policies{{alias.ext}}';

/** Attribute policies: do the attributes of the actor, the resource and the moment satisfy a rule? `explain` says which held, for debugging. */
export function createAuthorizer(): Authorizer {
  return new PolicyBasedAuthorizer({ clock: new SystemClock(), policies: attributePolicies });
}
