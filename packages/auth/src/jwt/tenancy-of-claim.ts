/** What the tenant claim of a token says: the tenant of the actor, or the tenants of an actor of several. */
export interface ClaimedTenancy {
  readonly tenantId?: string;
  /** Filled for an actor of several tenants only: the request names the one it works in (`x-tenant-id`). */
  readonly tenants?: readonly string[];
}

/**
 * A text claim is the tenant. A list, or an object keyed by tenant (the `organization` claim of
 * Keycloak, by alias), names the tenant when it holds one, and the tenants of the actor when it
 * holds several: none of them is the default, since choosing one is the request's decision.
 */
export function tenancyOfClaim(claim: unknown): ClaimedTenancy {
  if (typeof claim === 'string') {
    return claim === '' ? {} : { tenantId: claim };
  }

  if (typeof claim !== 'object' || claim === null) {
    return {};
  }

  const candidates: readonly unknown[] = Array.isArray(claim) ? claim : Object.keys(claim);
  const named = [...new Set(candidates.filter((candidate): candidate is string => typeof candidate === 'string'))];
  const [only] = named;

  if (named.length === 1 && only !== undefined) {
    return { tenantId: only };
  }

  return named.length === 0 ? {} : { tenants: named };
}
