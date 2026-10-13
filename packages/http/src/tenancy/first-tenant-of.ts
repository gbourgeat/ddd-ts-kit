import type { TenantResolver } from './tenant-resolver.js';

/** The first tenant one of the resolvers names, in order: `firstTenantOf(tenantFromSubdomain('app.example.com'), tenantFromClaim())`. */
export function firstTenantOf(...resolvers: readonly TenantResolver[]): TenantResolver {
  return (request) => {
    for (const resolver of resolvers) {
      const tenantId = resolver(request);

      if (tenantId !== undefined) {
        return tenantId;
      }
    }

    return undefined;
  };
}
