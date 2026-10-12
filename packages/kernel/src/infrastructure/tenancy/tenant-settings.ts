/**
 * The two settings of a transaction that the row-level security policies read:
 * `ddd_ts_kit.tenant_id`, the one tenant a write may name, and `ddd_ts_kit.reach`, the tenants a
 * read may see (`*` for an elevation over every tenant, otherwise a list separated by commas).
 */
export const TENANT_SETTINGS = { tenant: 'ddd_ts_kit.tenant_id', reach: 'ddd_ts_kit.reach' } as const;
