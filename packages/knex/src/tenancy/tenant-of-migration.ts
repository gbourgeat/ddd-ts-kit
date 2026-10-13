import type { Knex } from 'knex';

/**
 * In a migration run by `migrateTenantSchema`: the tenant it is applied for, to name its schemas
 * with `tenantSchemaOf`. A migration run otherwise names none, and this throws.
 */
export function tenantOfMigration(knex: Knex): string {
  const tenantId: unknown = knex.userParams['tenantId'];

  if (typeof tenantId !== 'string') {
    throw new TypeError(
      'This migration is applied per tenant: run it with migrateTenantSchema(knex, tenantId, config).',
    );
  }

  return tenantId;
}
