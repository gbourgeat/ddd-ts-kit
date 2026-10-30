import type { EntityManager, EntitySchema, ObjectLiteral, QueryDeepPartialEntity } from 'typeorm';
import { inserted } from './inserted';

/**
 * Inserts one row unless its key already exists, and says whether it did insert. Unlike
 * catching the unique violation, it leaves the surrounding transaction usable on PostgreSQL.
 * It serves the processed-event store and the first save of an aggregate alike. Columns left
 * out of `row` take their database default.
 *
 * Only a conflict on the primary key is ignored, on PostgreSQL and SQLite: a row that takes a
 * value another row holds under another unique constraint (an email) is refused by the database,
 * as any statement would be. MySQL has no conflict target: its `INSERT IGNORE` skips that row too.
 */
export function insertIgnoringConflict<Row extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntitySchema<Row>,
  row: QueryDeepPartialEntity<Row>,
): Promise<boolean> {
  const insert = manager.createQueryBuilder().insert().into(entity).values(row);

  if (!manager.dataSource.driver.supportedUpsertTypes.includes('on-conflict-do-update')) {
    return inserted(manager, insert.orIgnore());
  }

  const key = manager.dataSource.getMetadata(entity).primaryColumns.map((column) => column.databaseName);

  // Nothing to overwrite: TypeORM writes `ON CONFLICT ( <key> ) DO NOTHING`.
  return inserted(manager, insert.orUpdate([], key));
}
