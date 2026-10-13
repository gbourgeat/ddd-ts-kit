/**
 * What PostgreSQL answers when another transaction appended first: a duplicate (stream, version)
 * (23505); a serialization failure (40001) when the unit of work runs at REPEATABLE READ or
 * SERIALIZABLE and the head of the store moved since it began; a deadlock (40P01) when the same
 * transaction took other row locks in another order than a concurrent one. Each is a conflict the
 * caller retries, never a fault of the store.
 */
const CONFLICTS = new Set(['23505', '40001', '40P01']);
const WRAPPERS = ['cause', 'driverError', 'meta', 'originalError'];
const DEPTH = 4;

/** Whether an append lost to a concurrent one, whatever wraps the error of the driver: the driver alone (knex), `cause` (drizzle), `driverError` (TypeORM) or `meta` (Prisma). */
export function isAppendConflict(error: unknown, depth = DEPTH): boolean {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return false;
  }

  const code: unknown = Reflect.get(error, 'code');

  if (typeof code === 'string' && CONFLICTS.has(code)) {
    return true;
  }

  return WRAPPERS.some((key) => isAppendConflict(Reflect.get(error, key), depth - 1));
}
