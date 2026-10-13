import type { Knex } from 'knex';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { tenantSchemaOf } from './tenant-schema-of.js';

/**
 * The `begin` of a unit of work under the schema-per-tenant strategy, for SQL that names its
 * tables without a schema: the search path of the transaction is the tenant's schemas of the
 * contexts given, and nothing else, so that a missing table fails instead of falling through to
 * another schema. Work without a tenant gets an empty search path. The kit's own adapters name
 * their schema (`tenantSchemaTable`) and do not need it.
 */
export function tenantSearchPath(
  scope: ExecutionScope,
  schemas: readonly string[],
): (transaction: Knex.Transaction) => Promise<void> {
  return async (transaction) => {
    const tenantId = scope.current()?.tenantId;
    const path = tenantId === undefined ? [] : schemas.map((schema) => `"${tenantSchemaOf(schema, tenantId)}"`);

    await transaction.raw('select set_config(?, ?, true)', ['search_path', path.length === 0 ? '""' : path.join(', ')]);
  };
}
