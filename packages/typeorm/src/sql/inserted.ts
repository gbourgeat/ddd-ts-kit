import type { EntityManager, InsertQueryBuilder, ObjectLiteral } from 'typeorm';

/** Runs the insert and says whether it wrote its row. */
export async function inserted<Row extends ObjectLiteral>(
  manager: EntityManager,
  insert: InsertQueryBuilder<Row>,
): Promise<boolean> {
  const [statement, parameters] = insert.getQueryAndParameters();

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
