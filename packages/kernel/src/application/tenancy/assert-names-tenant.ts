import { NoCurrentTenantError } from '../audit/no-current-tenant-error';
import type { ExecutionContext } from '../execution/execution-context';

/**
 * What a store of tenant data checks before it reads or writes anything: the work names a tenant,
 * or reads under an elevation (`acrossTenants`). Anything else is refused with a
 * `NoCurrentTenantError`, work outside any execution scope included. An elevation widens a read,
 * never a write: a write names one tenant.
 */
export function assertNamesTenant(
  context: ExecutionContext | undefined,
  access: 'read' | 'write',
): asserts context is ExecutionContext {
  const elevated = access === 'read' && context?.elevation !== undefined;

  if (context?.tenantId === undefined && !elevated) {
    throw new NoCurrentTenantError();
  }
}
