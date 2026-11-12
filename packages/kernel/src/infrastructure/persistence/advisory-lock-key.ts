import type { AdvisoryLockOptions } from '../../application/persistence/advisory-lock-options';
import { tenantKey } from '../../application/tenancy/tenant-key';
import { AdvisoryLockOutsideUnitOfWorkError } from './advisory-lock-outside-unit-of-work-error';

/** What tells whether a unit of work is open: the context of each ORM package. */
export interface TransactionProbe {
  inTransaction(): boolean;
}

/**
 * For the `advisoryLock` of an ORM package: the text PostgreSQL hashes into the key of the lock,
 * `hashtextextended(text, 0)`, a 64-bit number. It is the key itself, or `tenant:<id>:<key>` with
 * the `tenant` option (`tenantKey`). Refused outside a unit of work
 * (`AdvisoryLockOutsideUnitOfWorkError`).
 *
 * Two texts may hash to the same number, about once in 2^64 pairs: two keys then wait for each
 * other as one would, and nothing else happens. A lock is never a wrong answer, only a wait.
 */
export function advisoryLockKey(context: TransactionProbe, key: string, options: AdvisoryLockOptions): string {
  if (!context.inTransaction()) {
    throw new AdvisoryLockOutsideUnitOfWorkError();
  }

  return options.tenant === undefined ? key : tenantKey(options.tenant, key);
}
