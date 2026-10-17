import { runGit } from '../commit/run-git.js';
import { commitOf } from './lost/commit-of.js';

/** A branch that holds commits of this one the trunk does not have: the branch it was stacked on, or one cut from it. */
export interface SharingBranch {
  readonly name: string;
  readonly tip: string;
  /** The newest commit both branches hold: the `--since` to pass when that branch landed. */
  readonly since: string;
}

/** Where to look for the branches that share commits with HEAD. */
export interface SharingQuery {
  readonly head: string;
  readonly trunk: string;
  /** The base recorded for the worker of this worktree, when it is not the trunk: the branch it was stacked on. */
  readonly parent?: string;
}

/**
 * The branches sharing with HEAD a commit the trunk does not have: the recorded parent, then the
 * local branches the trunk has not merged, the current one aside. A deleted parent is passed over.
 */
export function sharingBranches(root: string, query: SharingQuery): SharingBranch[] {
  const current = runGit(root, ['branch', '--show-current'])?.trim() ?? '';

  const local = (
    runGit(root, ['for-each-ref', `--no-merged=${query.trunk}`, '--format=%(refname:short)', 'refs/heads']) ?? ''
  )
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name !== '' && name !== current);

  const names = [...new Set([...(query.parent === undefined ? [] : [query.parent]), ...local])];

  return names.flatMap((name) => sharing(root, name, query));
}

function sharing(root: string, name: string, { head, trunk }: SharingQuery): SharingBranch[] {
  const tip = commitOf(root, name);
  const since = tip === undefined ? undefined : runGit(root, ['merge-base', head, tip])?.trim();

  if (tip === undefined || since === undefined || since === '' || tip === head) {
    return [];
  }

  return runGit(root, ['merge-base', '--is-ancestor', since, trunk]) === undefined ? [{ name, tip, since }] : [];
}
