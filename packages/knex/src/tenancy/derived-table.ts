import type { Knex } from 'knex';
import type { KnexContext } from '../unit-of-work/knex-context.js';

/**
 * The rows of a query, as a table to select from: a measure grouped by the query, then filtered,
 * sorted and paged by its output columns. The query is the one that reaches the tables, through
 * `tenantTable`: this helper adds no tenant condition of its own, and reaches no table itself.
 */
export function derivedTable<Row extends object>(
  context: KnexContext,
  query: Knex.QueryBuilder,
  alias: string,
): Knex.QueryBuilder<Row, Row[]> {
  return context.executor()<Row, Row[]>(query.as(alias));
}
