import { RoleBasedAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';
import { roles } from '{{alias.platform}}/auth/roles.js';

/** Roles: does one of the actor's roles grant this action? Another model is another adapter of the same port. */
export function createAuthorizer(): Authorizer {
  return new RoleBasedAuthorizer({ roles, systemRole: 'system' });
}
