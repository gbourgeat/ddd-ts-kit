import { advisoryLockKey, type AdvisoryLockOptions } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';

interface Answered {
  readonly rows: readonly { readonly acquired: boolean }[];
}

/**
 * `advisoryLock` without the wait: takes the lock on `key` for the unit of work if no other
 * transaction holds it and answers `true`, answers `false` at once otherwise
 * (`pg_try_advisory_xact_lock`). For work that is skipped, not queued, when somebody else is
 * already at it.
 */
export async function tryAdvisoryLock(
  context: KnexContext,
  key: string,
  options: AdvisoryLockOptions = {},
): Promise<boolean> {
  const text = advisoryLockKey(context, key, options);

  const { rows } = await context
    .executor()
    .raw<Answered>('select pg_try_advisory_xact_lock(hashtextextended(?, 0)) as acquired', [text]);

  return rows[0]?.acquired === true;
}
