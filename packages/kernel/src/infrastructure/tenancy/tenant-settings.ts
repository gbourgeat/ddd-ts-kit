/**
 * The three settings of a transaction that the row-level security policies read:
 * `ddd_ts_kit.tenant_id`, the one tenant a write may name (and a read sees);
 * `ddd_ts_kit.reach`, the other tenants an elevation lets a read see, separated by commas; and
 * `ddd_ts_kit.every_tenant`, `on` only for an elevation over every tenant. Work that is not
 * elevated sets the last two empty, so that nothing a tenant id holds can widen a read.
 */
export const TENANT_SETTINGS = {
  tenant: 'ddd_ts_kit.tenant_id',
  reach: 'ddd_ts_kit.reach',
  everyTenant: 'ddd_ts_kit.every_tenant',
} as const;
