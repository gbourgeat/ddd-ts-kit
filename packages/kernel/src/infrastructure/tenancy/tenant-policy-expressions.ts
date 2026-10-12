import { TENANT_SETTINGS } from './tenant-settings.js';

/** The name of the row-level security policy of a table of tenant data, in every adapter. */
export const TENANT_ISOLATION_POLICY = 'tenant_isolation';

/**
 * The two expressions of that policy on a column, quoted as SQL: a row is read when its tenant
 * is in `ddd_ts_kit.reach` (or the reach is `*`), and written only with the tenant of
 * `ddd_ts_kit.tenant_id`. Work that set neither reads nothing and writes nothing.
 */
export function tenantPolicyExpressions(column: string): { readonly using: string; readonly withCheck: string } {
  const reach = `current_setting('${TENANT_SETTINGS.reach}', true)`;
  const tenant = `current_setting('${TENANT_SETTINGS.tenant}', true)`;

  return {
    using: `${reach} = '*' or ${column} = any(string_to_array(${reach}, ','))`,
    withCheck: `${column} = ${tenant}`,
  };
}
