import type { AuthorizationContext } from '@ddd-ts-kit/auth';
import type { Role } from '@/platform/auth/role';

/** What the token alone grants, whatever the element: a line of `role-grants.ts`. */
export interface RoleGrant {
  /** The realm role that grants; left out, every authenticated actor of type `user`. */
  readonly role?: Role;
  /** Permission ids, `<context>:<name>`. */
  readonly permissions: readonly string[];
  /**
   * What the grant means for a list: `all` when its holder reads every element, `relationships`
   * when it only opens the use case and the stored tuples say which elements are theirs.
   */
  readonly listing: 'all' | 'relationships';
  /** A fact the requirement of the use case must state in its `context`; left out, the grant is unconditional. */
  readonly when?: (context: AuthorizationContext) => boolean;
}
