import type { EntityManager, EntitySchema, ObjectLiteral, QueryDeepPartialEntity } from 'typeorm';

/**
 * Inserts one row unless its key already exists, and says whether it did insert. Unlike
 * catching the unique violation, it leaves the surrounding transaction usable on PostgreSQL.
 * It serves the processed-event store and the first save of an aggregate alike. Columns left
 * out of `row` take their database default.
 */
export async function insertIgnoringConflict<Row extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntitySchema<Row>,
  row: QueryDeepPartialEntity<Row>,
): Promise<boolean> {
  const [statement, parameters] = manager
    .createQueryBuilder()
    .insert()
    .into(entity)
    .values(row)
    .orIgnore()
    .getQueryAndParameters();

  // The insert builder does not report whether the row was written; the structured result of
  // the query runner does, as the affected row count, on every driver.
  const transactional = manager.queryRunner;
  const runner = transactional ?? manager.dataSource.createQueryRunner();

  try {
    const result = await runner.query(statement, parameters, true);

    return result.affected === 1;
  } finally {
    if (transactional === undefined) {
      await runner.release();
    }
  }
}
