import { advisoryLockKey, type AdvisoryLockOptions } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';

/**
 * `advisoryLock` without the wait: takes the lock on `key` for the unit of work if no other
 * transaction holds it and answers `true`, answers `false` at once otherwise
 * (`pg_try_advisory_xact_lock`). For work that is skipped, not queued, when somebody else is
 * already at it.
 */
export async function tryAdvisoryLock(
  context: TypeOrmContext,
  key: string,
  options: AdvisoryLockOptions = {},
): Promise<boolean> {
  const text = advisoryLockKey(context, key, options);

  const rows: unknown = await context
    .manager()
    .query('select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired', [text]);

  const answered: unknown = Array.isArray(rows) ? rows[0] : undefined;

  return typeof answered === 'object' && answered !== null && 'acquired' in answered && answered.acquired === true;
}
