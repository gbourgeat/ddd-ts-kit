import { runGit } from '../commit/run-git';
import type { Workspace } from '../workspace';
import type { AcceptanceLock } from './acceptance-lock';
import { lockFileOf } from './lock-file-of';
import { lockIn } from './lock-in';

/** What git holds of the lock of a story. */
export type CommittedLock =
  /** Outside a git repository, or without git: nothing can be checked. */
  | { readonly kind: 'unchecked' }
  /** A repository that never committed a lock of the story. */
  | { readonly kind: 'none' }
  | { readonly kind: 'found'; readonly lock: AcceptanceLock };

/**
 * The last lock of the story that a commit holds, for the lock that was removed from the disk: a
 * lock written again over it would forget the scenarios that changed since, and the verdicts they need.
 */
export function readCommittedLock(ws: Workspace, story: string): CommittedLock {
  if (runGit(ws.root, ['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') {
    return { kind: 'unchecked' };
  }

  const file = lockFileOf(story);
  const commit = runGit(ws.root, ['log', '-1', '--diff-filter=AM', '--format=%H', '--', file])?.trim();

  if (commit === undefined || commit === '') {
    return { kind: 'none' };
  }

  // `./` makes the path relative to the project, which may stand below the top of the repository.
  const text = runGit(ws.root, ['show', '--end-of-options', `${commit}:./${file}`]);
  const lock = text === undefined ? undefined : lockIn(text, story);

  return lock === undefined ? { kind: 'none' } : { kind: 'found', lock };
}
