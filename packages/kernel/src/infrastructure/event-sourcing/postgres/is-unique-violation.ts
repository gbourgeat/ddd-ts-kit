const UNIQUE_VIOLATION = '23505';
const WRAPPERS = ['cause', 'driverError', 'meta', 'originalError'];
const DEPTH = 4;

/**
 * Whether PostgreSQL refused a statement for a duplicate key, whatever wraps its error: the
 * driver alone (knex), `cause` (drizzle), `driverError` (TypeORM) or `meta` (Prisma).
 */
export function isUniqueViolation(error: unknown, depth = DEPTH): boolean {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return false;
  }

  if (Reflect.get(error, 'code') === UNIQUE_VIOLATION) {
    return true;
  }

  return WRAPPERS.some((key) => isUniqueViolation(Reflect.get(error, key), depth - 1));
}
