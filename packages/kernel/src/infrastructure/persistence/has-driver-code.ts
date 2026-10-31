import { hasDriverError } from './has-driver-error';

/**
 * Whether the error of a driver carries one of `codes`, whatever wraps it (`hasDriverError`).
 * The code is read in `code` (PostgreSQL, Prisma) and in `sqlState` (MySQL).
 */
export function hasDriverCode(error: unknown, codes: ReadonlySet<string>): boolean {
  return hasDriverError(error, (layer) => ['code', 'sqlState'].some((key) => isOneOf(Reflect.get(layer, key), codes)));
}

function isOneOf(value: unknown, codes: ReadonlySet<string>): boolean {
  return typeof value === 'string' && codes.has(value);
}
