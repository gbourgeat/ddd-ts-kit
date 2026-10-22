import { DomainError } from '../../domain/errors/domain-error';
import { hasDriverCode } from './has-driver-code';

/**
 * What a database answers when it gives a transaction up for a concurrent one: a serialization
 * failure (40001, the SQLSTATE MySQL also gives a deadlock) or a deadlock (40P01) of PostgreSQL,
 * `P2034` of Prisma, which stands for both. A refusal already raised is never one.
 */
const CONFLICTS = new Set(['40001', '40P01', 'P2034']);

export function isTransactionConflict(error: unknown): boolean {
  return !(error instanceof DomainError) && hasDriverCode(error, CONFLICTS);
}
