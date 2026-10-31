import type { EntityManager, EntitySchema, ObjectLiteral, QueryDeepPartialEntity } from 'typeorm';
import { inserted } from './inserted';

/**
 * Inserts one row unless it takes a value a unique constraint keeps, whichever constraint, and
 * says whether it did insert: the job store, whose idempotency key is not its primary key.
 */
export function insertIgnoringAnyConflict<Row extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntitySchema<Row>,
  row: QueryDeepPartialEntity<Row>,
): Promise<boolean> {
  return inserted(manager, manager.createQueryBuilder().insert().into(entity).values(row).orIgnore());
}
