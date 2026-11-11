import type { Config } from '../config';

/** The authorization models `init` writes the role vocabulary of the platform for (`auth/authorization/role.ts`). */
const WITH_ROLES: readonly string[] = ['rbac', 'abac'];

/**
 * True when the platform declares its roles from the start, `Role` in `auth/authorization/role.ts`:
 * what a test names a role with is then typed by it. Relationships and a custom authorizer start
 * without that file; `generate route-group --role` writes it when a guard asks for a role.
 */
export function declaresRoles(config: Config): boolean {
  return WITH_ROLES.includes(config.stack.authz);
}
