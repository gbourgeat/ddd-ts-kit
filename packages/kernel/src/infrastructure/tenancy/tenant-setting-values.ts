import type { ExecutionContext } from '../../application/execution/execution-context.js';
import { assertTenantId } from '../../application/tenancy/assert-tenant-id.js';

/**
 * The values of `TENANT_SETTINGS` for the work in progress, which a unit of work under
 * row-level security sets per transaction: empty for work that names no tenant. Every tenant id
 * is checked against the grammar of `isTenantId` again here, the last step before SQL, so that a
 * context built by hand can never set a list or a wildcard; only an elevation sets the reach.
 */
export function tenantSettingValues(context: ExecutionContext | undefined): {
  tenant: string;
  reach: string;
  everyTenant: string;
} {
  const tenant = context?.tenantId === undefined ? '' : assertTenantId(context.tenantId);
  const elevation = context?.elevation;

  if (elevation === undefined) {
    return { tenant, reach: '', everyTenant: '' };
  }

  if (elevation.tenants === 'all') {
    return { tenant, reach: '', everyTenant: 'on' };
  }

  return { tenant, reach: elevation.tenants.map(assertTenantId).join(','), everyTenant: '' };
}
