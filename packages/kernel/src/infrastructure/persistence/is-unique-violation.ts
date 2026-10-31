import { DomainError } from '../../domain/errors/domain-error';
import { hasDriverCode } from './has-driver-code';
import { hasDriverError } from './has-driver-error';

/**
 * What a database answers when a row takes a value a unique constraint keeps, its key
 * included: 23505 of PostgreSQL, `ER_DUP_ENTRY` of MySQL, `SQLITE_CONSTRAINT_UNIQUE` and
 * `SQLITE_CONSTRAINT_PRIMARYKEY` of SQLite (better-sqlite3), `P2002` of Prisma.
 */
const UNIQUE_VIOLATIONS = new Set([
  '23505',
  'ER_DUP_ENTRY',
  'SQLITE_CONSTRAINT_UNIQUE',
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  'P2002',
]);

/** libsql and node-sqlite3 give every constraint the raw `SQLITE_CONSTRAINT`: the message tells a unique one. */
const RAW_SQLITE_CONSTRAINT = 'SQLITE_CONSTRAINT';
const UNIQUE_MESSAGE = /\b(?:UNIQUE|PRIMARY KEY) constraint failed\b/;

/** Whether `error` is a unique violation of the database. A refusal already raised is never one. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    !(error instanceof DomainError) &&
    (hasDriverCode(error, UNIQUE_VIOLATIONS) || hasDriverError(error, isRawSqliteUnique))
  );
}

function isRawSqliteUnique(layer: object): boolean {
  const message: unknown = Reflect.get(layer, 'message');

  return (
    Reflect.get(layer, 'code') === RAW_SQLITE_CONSTRAINT && typeof message === 'string' && UNIQUE_MESSAGE.test(message)
  );
}
