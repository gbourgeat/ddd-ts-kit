import { advisoryLockKey, type AdvisoryLockOptions } from '@ddd-ts-kit/kernel';
import { rawRows } from '../personal-data/raw-rows';
import type { PrismaLockingContext } from './prisma-locking-context';

/**
 * `advisoryLock` without the wait: takes the lock on `key` for the unit of work if no other
 * transaction holds it and answers `true`, answers `false` at once otherwise
 * (`pg_try_advisory_xact_lock`). For work that is skipped, not queued, when somebody else is
 * already at it.
 */
export async function tryAdvisoryLock(
  context: PrismaLockingContext,
  key: string,
  options: AdvisoryLockOptions = {},
): Promise<boolean> {
  const text = advisoryLockKey(context, key, options);

  const [answered] = await rawRows(
    context.client(),
    'select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired',
    [text],
  );

  return answered?.['acquired'] === true;
}
