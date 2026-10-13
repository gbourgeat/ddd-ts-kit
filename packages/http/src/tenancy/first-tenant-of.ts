import type { TenantResolver } from './tenant-resolver.js';

/**
 * The first tenant one of the resolvers names, in order: `firstTenantOf(tenantFromSubdomain('app.example.com'), tenantFromClaim())`.
 * It reads the headers every one of them reads.
 */
export function firstTenantOf(...resolvers: readonly TenantResolver[]): TenantResolver {
  const resolve: TenantResolver = (request) => {
    for (const resolver of resolvers) {
      const tenantId = resolver(request);

      if (tenantId !== undefined) {
        return tenantId;
      }
    }

    return undefined;
  };

  const headers = [...new Set(resolvers.flatMap((resolver) => resolver.headers ?? []))];

  return headers.length === 0 ? resolve : Object.assign(resolve, { headers });
}
