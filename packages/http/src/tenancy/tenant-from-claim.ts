import type { TenantResolver } from './tenant-resolver';

/** The tenant of the credential (`Actor.tenantId`), which the execution context takes by default anyway: for `firstTenantOf`. */
export function tenantFromClaim(): TenantResolver {
  return ({ actor }) => actor.tenantId;
}
