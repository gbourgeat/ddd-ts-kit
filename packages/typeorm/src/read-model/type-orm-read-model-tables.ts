import { PostgresReadModelTables, type ReadModelTablesOptions } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';

/**
 * The read model tables of the database, on PostgreSQL, checked in one pass through the entity
 * manager of the context: what an application asks at its start, whatever builds its stores and
 * whenever, and what a script asks of the database of a deployment before it. Each table can hold
 * the trace of a deleted row, or is named with its columns and the migration to write.
 */
export function typeOrmReadModelTables(
  context: TypeOrmContext,
  options: ReadModelTablesOptions = {},
): PostgresReadModelTables {
  return new PostgresReadModelTables(async (statement, parameters) => {
    const rows: unknown = await context.manager().query(statement, [...parameters]);
    const list: readonly unknown[] = Array.isArray(rows) ? rows : [];

    return list.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null);
  }, options);
}
