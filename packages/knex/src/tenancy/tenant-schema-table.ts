import type { Knex } from 'knex';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { tableIn } from './table-in.js';
import { tenantSchemaOf } from './tenant-schema-of.js';
import type { TenantSchemaTarget } from './tenant-schema-target.js';

/**
 * The table in the schema of the tenant of the work in progress (`<schema>__<tenant>`): reads
 * and writes reach that tenant's copy only. Work that names no tenant is refused, an elevation
 * included: across tenants, staff read one tenant schema at a time.
 */
export function tenantSchemaTable<Row extends object>(
  context: KnexContext,
  scope: ExecutionScope,
  target: TenantSchemaTarget,
): Knex.QueryBuilder<Row, Row[]> {
  const schema = tenantSchemaOf(target.schema, tenantScopeOf(scope).tenantId);

  return tableIn<Row>(context, { table: target.table, schema });
}
