import type { Knex } from 'knex';
import { TENANT_SETTINGS, tenantSettingValues, type ExecutionScope } from '@ddd-ts-kit/kernel';

/**
 * The `begin` of a unit of work under row-level security: sets the tenant settings for the
 * transaction only (`set_config(..., true)`), from the execution context of the work, so that a
 * pooled connection never carries them to the next transaction. Work without a tenant sets them
 * empty, and the policies then show it nothing.
 */
export function tenantSession(scope: ExecutionScope): (transaction: Knex.Transaction) => Promise<void> {
  return async (transaction) => {
    const { tenant, reach, everyTenant } = tenantSettingValues(scope.current());

    await transaction.raw('select set_config(?, ?, true), set_config(?, ?, true), set_config(?, ?, true)', [
      TENANT_SETTINGS.tenant,
      tenant,
      TENANT_SETTINGS.reach,
      reach,
      TENANT_SETTINGS.everyTenant,
      everyTenant,
    ]);
  };
}
