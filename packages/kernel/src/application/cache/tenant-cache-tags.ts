/**
 * The tags of a tenant: each one under the identifier of the tenant, `acme/calendar:c-1`, so
 * that a purge for one tenant never reaches the answers of another, and a kind (`calendar`) is
 * purged tenant by tenant. Without a tenant, the tags as they are.
 */
export function tenantCacheTags(tags: readonly string[], tenantId: string | undefined): readonly string[] {
  if (tenantId === undefined) {
    return tags;
  }

  const prefix = `${encodeURIComponent(tenantId)}/`;

  return tags.map((tag) => `${prefix}${tag}`);
}
