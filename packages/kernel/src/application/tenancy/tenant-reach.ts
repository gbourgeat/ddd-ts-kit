/**
 * What a read may see: the one tenant of the work in progress, or, under an elevation, the
 * tenants it names (`all` for every one).
 */
export type TenantReach =
  | { readonly kind: 'tenant'; readonly tenantId: string }
  | { readonly kind: 'elevated'; readonly tenants: 'all' | readonly string[] };
