import { runGit } from '../commit/run-git.js';
import type { BasePoint } from './base-point.js';
import type { BaseQuery } from './base-query.js';
import { verifyMerge } from './lost/verify-merge.js';

/**
 * The base worker-scope recorded for the worker of this worktree, when it is a commit of this
 * branch the trunk does not hold (a branch stacked on another, whose parent is gone): proven when
 * every line it added since the trunk is on the trunk, as if the trunk had merged it. Otherwise
 * the lines missing are answered, for a person to confirm the base with `--since`. Undefined
 * without such a record.
 */
export function recordedBase(query: BaseQuery, fork: string): BasePoint | undefined {
  const { root, head, trunk, repo } = query;
  const recorded = query.worker?.baseCommit;

  if (
    recorded === undefined ||
    runGit(root, ['merge-base', '--is-ancestor', recorded, head]) === undefined ||
    runGit(root, ['merge-base', '--is-ancestor', recorded, trunk]) !== undefined
  ) {
    return undefined;
  }

  const base = runGit(root, ['merge-base', recorded, trunk])?.trim() || fork;

  const check = verifyMerge(repo, {
    commit: trunk,
    subject: 'recorded base',
    base,
    baseFrom: 'option',
    ours: recorded,
    theirs: trunk,
    accepted: [],
  });

  return {
    commit: recorded,
    evidence: 'recorded',
    ...(check.errors.length === 0 ? {} : { notOnTrunk: check.errors }),
  };
}
