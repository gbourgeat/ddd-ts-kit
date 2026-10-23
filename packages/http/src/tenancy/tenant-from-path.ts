import type { TenantResolver } from './tenant-resolver';

/** A path parameter, `tenantId` by default: `/tenants/:tenantId/invoices`. A route without it names none. */
export function tenantFromPath(parameter = 'tenantId'): TenantResolver {
  return ({ params }) => {
    const value = params[parameter];

    return typeof value === 'string' && value !== '' ? value : undefined;
  };
}
