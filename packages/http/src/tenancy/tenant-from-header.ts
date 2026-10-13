import type { TenantRequest } from './tenant-request.js';
import type { TenantResolver } from './tenant-resolver.js';

/**
 * The value of a header, `x-tenant-id` by default; a header sent twice names none. A cached
 * answer varies on the header (`Vary`), so that a cache keeps one copy per tenant.
 */
export function tenantFromHeader(name = 'x-tenant-id'): TenantResolver {
  const header = name.toLowerCase();

  const resolve = ({ headers }: TenantRequest): string | undefined => {
    const value = headers[header];

    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  };

  return Object.assign(resolve, { headers: [header] });
}
