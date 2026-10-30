const WRAPPERS = ['cause', 'driverError', 'meta', 'originalError'];
const DEPTH = 4;

/**
 * Whether the error of a driver, or an error it wraps, passes `test`: the driver alone (knex),
 * `cause` (drizzle), `driverError` (TypeORM), `meta` (Prisma) or `originalError`.
 */
export function hasDriverError(error: unknown, test: (layer: object) => boolean, depth = DEPTH): boolean {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return false;
  }

  return test(error) || WRAPPERS.some((key) => hasDriverError(Reflect.get(error, key), test, depth - 1));
}
