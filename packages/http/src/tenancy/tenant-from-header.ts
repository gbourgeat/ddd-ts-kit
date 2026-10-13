import type { TenantResolver } from './tenant-resolver.js';

/** The value of a header, `x-tenant-id` by default; a header sent twice names none. */
export function tenantFromHeader(name = 'x-tenant-id'): TenantResolver {
  const header = name.toLowerCase();

  return ({ headers }) => {
    const value = headers[header];

    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  };
}
