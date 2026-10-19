const WRAPPERS = ['cause', 'driverError', 'meta', 'originalError'];
const DEPTH = 4;

/**
 * Whether the error of a driver carries one of `codes`, whatever wraps it: the driver alone
 * (knex), `cause` (drizzle), `driverError` (TypeORM), `meta` (Prisma) or `originalError`. The
 * code is read in `code` (PostgreSQL, Prisma) and in `sqlState` (MySQL).
 */
export function hasDriverCode(error: unknown, codes: ReadonlySet<string>, depth = DEPTH): boolean {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return false;
  }

  if (['code', 'sqlState'].some((key) => isOneOf(Reflect.get(error, key), codes))) {
    return true;
  }

  return WRAPPERS.some((key) => hasDriverCode(Reflect.get(error, key), codes, depth - 1));
}

function isOneOf(value: unknown, codes: ReadonlySet<string>): boolean {
  return typeof value === 'string' && codes.has(value);
}
