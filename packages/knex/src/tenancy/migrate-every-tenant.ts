import type { Knex } from 'knex';
import type { TenantDirectory } from '@ddd-ts-kit/kernel';
import type { TenantDatabases } from './tenant-databases.js';

/**
 * Applies `migrate` to the database of every tenant of the directory, one after the other, and
 * stops at the first that fails, naming it: the tenants before it are migrated, the ones after
 * are not, and running it again resumes. Provisioning a tenant is the same call for one tenant.
 */
export async function migrateEveryTenant(
  databases: TenantDatabases,
  directory: TenantDirectory,
  migrate: (knex: Knex, tenantId: string) => Promise<void>,
): Promise<void> {
  for (const tenantId of await directory.tenants()) {
    try {
      await databases.lease(tenantId, (database) => migrate(database, tenantId));
    } catch (error) {
      throw new Error(`The migration of tenant "${tenantId}" failed`, { cause: error });
    }
  }
}
