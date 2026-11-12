import type { EntityManager, EntitySchema, InsertQueryBuilder, ObjectLiteral, QueryDeepPartialEntity } from 'typeorm';
import { UniqueViolationError } from '@ddd-ts-kit/kernel';
import { inserted } from './inserted';

/**
 * Inserts one row unless its key already exists, and says whether it did insert. Unlike
 * catching the unique violation, it leaves the surrounding transaction usable on PostgreSQL.
 * It serves the processed-event store and the first save of an aggregate alike. Columns left
 * out of `row` take their database default.
 *
 * Only a conflict on the primary key is ignored, on PostgreSQL and SQLite: a row that takes a
 * value another row holds under another unique constraint (an email) is refused by the database,
 * as any statement would be. MySQL has no conflict target and its `INSERT IGNORE` skips that row
 * too: when it wrote nothing, one query asks whether a row holds the key, and when none does, a
 * `UniqueViolationError` is raised, as the other databases answer.
 *
 * Where the database has a conflict target, that takes two statements at most. On PostgreSQL a
 * target on the key alone lets two inserts of one key made at once meet on the other unique index
 * first, and one of them is then refused for a value no other row holds. The first statement
 * skips on any unique value; when it wrote nothing, the second names the key: `false` for a key
 * that is held, and the refusal of the database for a value another row holds.
 */
export async function insertIgnoringConflict<Row extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntitySchema<Row>,
  row: QueryDeepPartialEntity<Row>,
): Promise<boolean> {
  const inserting = (): InsertQueryBuilder<Row> => manager.createQueryBuilder().insert().into(entity).values(row);
  const primary = manager.dataSource.getMetadata(entity).primaryColumns;

  if (await inserted(manager, inserting().orIgnore())) {
    return true;
  }

  if (!manager.dataSource.driver.supportedUpsertTypes.includes('on-conflict-do-update')) {
    return keyTaken(
      manager,
      entity,
      Object.fromEntries(primary.map((column) => [column.propertyName, Reflect.get(row, column.propertyName)])),
    );
  }

  // Nothing to overwrite: TypeORM writes `ON CONFLICT ( <key> ) DO NOTHING`.
  return inserted(
    manager,
    inserting().orUpdate(
      [],
      primary.map((column) => column.databaseName),
    ),
  );
}

/** Whether a row holds `key`; when none does, the row was skipped for another unique value. */
async function keyTaken<Row extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntitySchema<Row>,
  key: ObjectLiteral,
): Promise<false> {
  const holders = await manager.createQueryBuilder(entity, 'holder').where(key).getCount();

  if (holders === 0) {
    throw new UniqueViolationError(Object.values(key).map(String).join(':'));
  }

  return false;
}
