import type { ExecutionContext } from '../../application/execution/execution-context.js';

/**
 * The values of `TENANT_SETTINGS` for the work in progress, which a unit of work under
 * row-level security sets per transaction: empty for work that names no tenant.
 */
export function tenantSettingValues(context: ExecutionContext | undefined): { tenant: string; reach: string } {
  const tenant = context?.tenantId ?? '';
  const elevation = context?.elevation;

  if (elevation === undefined) {
    return { tenant, reach: tenant };
  }

  return { tenant, reach: elevation.tenants === 'all' ? '*' : elevation.tenants.join(',') };
}
