import { sql } from 'drizzle-orm';
import { TENANT_SETTINGS, tenantSettingValues, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { SqlExecutor } from './sql-executor';

/**
 * The `begin` of a unit of work under row-level security: sets the tenant settings for the
 * transaction only, from the execution context of the work, so that a pooled connection never
 * carries them to the next transaction. Work without a tenant sets them empty, and the policies
 * then show it nothing.
 */
export function tenantSession(scope: ExecutionScope): (transaction: SqlExecutor) => Promise<void> {
  return async (transaction) => {
    const { tenant, reach, everyTenant } = tenantSettingValues(scope.current());

    await transaction.execute(
      sql`select set_config(${TENANT_SETTINGS.tenant}, ${tenant}, true), set_config(${TENANT_SETTINGS.reach}, ${reach}, true), set_config(${TENANT_SETTINGS.everyTenant}, ${everyTenant}, true)`,
    );
  };
}
