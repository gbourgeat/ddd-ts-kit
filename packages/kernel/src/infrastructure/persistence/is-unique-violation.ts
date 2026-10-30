import { DomainError } from '../../domain/errors/domain-error';
import { hasDriverCode } from './has-driver-code';

/**
 * What a database answers when a row takes a value a unique constraint keeps: 23505 of
 * PostgreSQL, `ER_DUP_ENTRY` of MySQL, `SQLITE_CONSTRAINT_UNIQUE` of SQLite (better-sqlite3),
 * `P2002` of Prisma. A refusal already raised is never one.
 */
const UNIQUE_VIOLATIONS = new Set(['23505', 'ER_DUP_ENTRY', 'SQLITE_CONSTRAINT_UNIQUE', 'P2002']);

export function isUniqueViolation(error: unknown): boolean {
  return !(error instanceof DomainError) && hasDriverCode(error, UNIQUE_VIOLATIONS);
}
