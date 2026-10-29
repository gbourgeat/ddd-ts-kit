import { runGit } from '../commit/run-git';
import type { Workspace } from '../workspace';
import type { AcceptanceLock } from './acceptance-lock';
import { lockFileOf } from './lock-file-of';
import { lockIn } from './lock-in';

/** What git holds of the lock of a story. */
export type CommittedLock =
  /** Git did not answer: no repository, or git not installed. */
  | { readonly kind: 'unchecked' }
  /** A repository that never committed a lock of the story. */
  | { readonly kind: 'none' }
  /** The last commit that touched the lock deleted it: the removal was decided and committed. */
  | { readonly kind: 'deleted'; readonly commit: string }
  | { readonly kind: 'found'; readonly lock: AcceptanceLock; readonly commit: string };

/**
 * The last lock of the story that a commit holds, for a lock that was removed or emptied on the
 * disk: a lock written again over it would forget the scenarios that changed since, and the
 * verdicts they need. One `git log` tells no answer (git undefined) from no commit (empty).
 */
export function readCommittedLock(ws: Workspace, story: string): CommittedLock {
  const file = lockFileOf(story);

  const last = runGit(ws.root, ['log', '-1', '--diff-filter=AMD', '--name-status', '--format=%H', '--', file]);

  if (last === undefined) {
    return { kind: 'unchecked' };
  }

  const [commit = '', , status = ''] = last.split('\n');

  if (commit === '') {
    return { kind: 'none' };
  }

  if (status.startsWith('D')) {
    return { kind: 'deleted', commit };
  }

  // `./` makes the path relative to the project, which may stand below the top of the repository.
  const text = runGit(ws.root, ['show', '--end-of-options', `${commit}:./${file}`]);
  const lock = text === undefined ? undefined : lockIn(text, story);

  return lock === undefined ? { kind: 'none' } : { kind: 'found', lock, commit };
}
