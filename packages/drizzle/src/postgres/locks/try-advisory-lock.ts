import { sql } from 'drizzle-orm';
import { advisoryLockKey, type AdvisoryLockOptions } from '@ddd-ts-kit/kernel';
import { rowsOf } from '../read-model/rows-of';
import type { DrizzleLockingContext } from './drizzle-locking-context';

/**
 * `advisoryLock` without the wait: takes the lock on `key` for the unit of work if no other
 * transaction holds it and answers `true`, answers `false` at once otherwise
 * (`pg_try_advisory_xact_lock`). For work that is skipped, not queued, when somebody else is
 * already at it.
 */
export async function tryAdvisoryLock(
  context: DrizzleLockingContext,
  key: string,
  options: AdvisoryLockOptions = {},
): Promise<boolean> {
  const text = advisoryLockKey(context, key, options);

  const [answered] = rowsOf(
    await context.executor().execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${text}, 0)) as acquired`),
  );

  return answered?.['acquired'] === true;
}
