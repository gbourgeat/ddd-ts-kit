import type { Actor } from '@ddd-ts-kit/kernel';
import type { Authorizer } from '../authorization/authorizer';
import type { Grant } from '../permissions/grant';
import { RoleBasedAuthorizer } from '../rbac/role-based-authorizer';
import { anActor } from './an-actor';

/** What `holdersOf` gives a spec: an actor that holds the permissions, and the authorizer that grants them. */
export interface Holders {
  /** A user of the role `holder`, the role the authorizer grants the permissions to. */
  readonly holder: Actor;
  /**
   * Grants the permissions to the role `holder` and to every system actor (a job, a reaction),
   * nothing to anybody else: an actor built by `anActor()` alone is refused.
   */
  readonly authorizer: Authorizer;
}

/**
 * The arrangement of rights a use case spec needs: an actor holding the permissions, and an
 * authorizer granting them to it and to the system actors. Hand the authorizer to
 * `authorizationModule` or `authorizationMiddleware`, and the holder to the command.
 *
 * `const { holder, authorizer } = holdersOf(billingPermissions['invoice.issue']);`
 */
export function holdersOf(...granted: readonly [Grant, ...Grant[]]): Holders {
  return {
    holder: anActor().withRole('holder').build(),
    authorizer: new RoleBasedAuthorizer({ roles: { holder: granted, system: granted }, systemRole: 'system' }),
  };
}
