import { TENANT_SETTINGS } from './tenant-settings.js';

/**
 * The expressions of the row-level security policies on a column, quoted as SQL. `read`: the row
 * belongs to `ddd_ts_kit.tenant_id`, to a tenant of `ddd_ts_kit.reach`, or
 * `ddd_ts_kit.every_tenant` is `on`. `write`: the row belongs to `ddd_ts_kit.tenant_id`, whatever
 * an elevation widened. Work that set nothing reads nothing and writes nothing.
 */
export function tenantPolicyExpressions(column: string): { readonly read: string; readonly write: string } {
  const setting = (name: string): string => `current_setting('${name}', true)`;
  const tenant = `${column} = ${setting(TENANT_SETTINGS.tenant)}`;
  const reach = `${column} = any(string_to_array(${setting(TENANT_SETTINGS.reach)}, ','))`;
  const everyTenant = `${setting(TENANT_SETTINGS.everyTenant)} = 'on'`;

  return { read: `${tenant} or ${reach} or ${everyTenant}`, write: tenant };
}
