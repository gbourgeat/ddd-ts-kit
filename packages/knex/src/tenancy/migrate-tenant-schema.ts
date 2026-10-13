import type { Knex } from 'knex';
import { tenantSchemaOf } from './tenant-schema-of.js';

/** Where the migrations of each tenant are recorded: `migrations__<tenant>`. */
const BOOKKEEPING_SCHEMA = 'migrations';

/**
 * Applies the migrations of `config` (the tenant migrations, a directory of their own) for one
 * tenant: they read the tenant with `tenantOfMigration(knex)`, and the record of what was
 * applied lives in the tenant's own schema, so every tenant moves forward on its own. This is
 * also how a tenant is provisioned: its first run creates its schemas and tables.
 */
export async function migrateTenantSchema(knex: Knex, tenantId: string, config: Knex.MigratorConfig): Promise<void> {
  const schemaName = tenantSchemaOf(BOOKKEEPING_SCHEMA, tenantId);

  await knex.schema.createSchemaIfNotExists(schemaName);
  await knex.withUserParams({ ...knex.userParams, tenantId }).migrate.latest({ ...config, schemaName });
}
