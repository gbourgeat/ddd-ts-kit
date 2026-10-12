import type { Knex } from 'knex';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import type { TenantTableTarget } from './tenant-table-target.js';

/** The table, in its schema, on the executor of the unit of work. */
export function tableIn<Row extends object>(
  context: KnexContext,
  target: TenantTableTarget,
): Knex.QueryBuilder<Row, Row[]> {
  const table = context.executor()<Row, Row[]>(target.table);

  return target.schema === undefined ? table : table.withSchema(target.schema);
}
