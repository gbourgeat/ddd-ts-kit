import { DomainError } from '../../domain/errors/domain-error';
import { hasDriverCode } from './has-driver-code';

/**
 * What an ORM answers when a transaction waited too long for a connection or ran past its time:
 * `P2028` (the transaction API of Prisma: not started within `maxWait`, or expired after
 * `timeout`) and `P2024` (no connection from the pool in time) of Prisma, `KnexTimeoutError`
 * (no connection within `acquireConnectionTimeout`) of Knex. A refusal already raised is never one.
 */
const TIMEOUTS = new Set(['P2028', 'P2024']);

export function isTransactionTimeout(error: unknown): boolean {
  if (error instanceof DomainError) {
    return false;
  }

  return hasDriverCode(error, TIMEOUTS) || (error instanceof Error && error.name === 'KnexTimeoutError');
}
