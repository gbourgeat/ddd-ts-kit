import type { TenantResolver } from './tenant-resolver.js';
import { UnknownTenantError } from './unknown-tenant-error.js';

/**
 * The tenant `resolver` names, when the deployment serves it: one it does not serve is answered
 * 404 before anything reads it, whoever calls, so that a credential or a header naming a tenant
 * left out of the directory never writes data its jobs and its operators know nothing of.
 */
export function servedTenantOf(resolver: TenantResolver, served: readonly string[]): TenantResolver {
  const tenants = new Set(served);

  return (request) => {
    const tenantId = resolver(request);

    if (tenantId !== undefined && !tenants.has(tenantId)) {
      throw new UnknownTenantError('The request names a tenant this deployment does not serve');
    }

    return tenantId;
  };
}
