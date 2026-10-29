import type { Workspace } from '../workspace';
import type { AcceptanceLock } from './acceptance-lock';
import { lockFileOf } from './lock-file-of';
import { readCommittedLock } from './read-committed-lock';
import { readLock } from './read-lock';
import { readVerdicts } from './read-verdicts';

/** The lock a story is held to. */
export type PreviousLock =
  | { readonly kind: 'on-disk'; readonly lock: AcceptanceLock }
  /** The lock file is missing, unreadable or holds nothing: the last lock a commit holds stands in. */
  | { readonly kind: 'committed'; readonly lock: AcceptanceLock; readonly commit: string }
  /** A commit deleted the lock: the removal was decided. */
  | { readonly kind: 'deleted'; readonly commit: string }
  | { readonly kind: 'none' }
  /** A removal is plausible and git did not answer. */
  | { readonly kind: 'unchecked' };

/**
 * The lock of the story to compare with: the one on the disk when it holds something; otherwise
 * the last one a commit holds. Outside git nothing can be compared, and it is only said when a
 * removal is plausible: a lock file that is there but holds nothing, or a verdict on the story,
 * which only a story that was locked has. A first lock outside git says nothing.
 */
export function previousLockOf(ws: Workspace, story: string): PreviousLock {
  const onDisk = readLock(ws, story);

  if (onDisk !== undefined && holdsSomething(onDisk)) {
    return { kind: 'on-disk', lock: onDisk };
  }

  const committed = readCommittedLock(ws, story);

  if (committed.kind === 'found') {
    return { kind: 'committed', lock: committed.lock, commit: committed.commit };
  }

  if (committed.kind !== 'unchecked') {
    return committed;
  }

  const plausible = ws.exists(lockFileOf(story)) || readVerdicts(ws, story).length > 0;

  return { kind: plausible ? 'unchecked' : 'none' };
}

function holdsSomething(lock: AcceptanceLock): boolean {
  return lock.scenarios.length > 0 || lock.regression.length > 0 || Object.keys(lock.criteria).length > 0;
}
