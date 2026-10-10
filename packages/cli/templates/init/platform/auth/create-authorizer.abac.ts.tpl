import { PolicyBasedAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';
import { SystemClock } from '@ddd-ts-kit/kernel';
import { attributePolicies } from '{{alias.platform}}/auth/attribute-policies.js';

/** Attribute policies: do the attributes of the actor, the resource and the moment satisfy a rule? */
export function createAuthorizer(): Authorizer {
  return new PolicyBasedAuthorizer({ clock: new SystemClock(), policies: attributePolicies });
}
