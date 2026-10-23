import { RoleBasedAuthorizer, type Authorizer } from '@ddd-ts-kit/auth';
import { Role } from '{{alias.platform}}/auth/authorization/role{{alias.ext}}';
import { roles } from '{{alias.platform}}/auth/roles/roles{{alias.ext}}';

/** Roles: does one of the actor's roles grant this action? `explain` says which, for debugging. Another model is another adapter of the same port. */
export function createAuthorizer(): Authorizer {
  return new RoleBasedAuthorizer({ roles, systemRole: Role.System });
}
