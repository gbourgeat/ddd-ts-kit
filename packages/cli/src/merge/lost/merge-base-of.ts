import { CliError } from '../../cli-error';
import { runGit } from '../../commit/run-git';
import { commitOf } from '../../commit/commit-of';
import { knownCommit } from '../../commit/known-commit';
import type { MergeToVerify } from './merge-to-verify';

/** The two sides of a merge, and what names its base when git should not compute it. */
export interface BaseCandidates {
  readonly ours: string;
  readonly theirs: string;
  /** `--base`, which must name a commit. */
  readonly option?: string;
  /** The `Merge-Base:` trailer; a value that names no commit is passed over. */
  readonly trailer?: string;
}

/**
 * The base a merge is compared against: `--base`, else the `Merge-Base:` trailer the merge
 * recorded (a merge computed from its own base, after a squash, has another base than git
 * would find), else `git merge-base`.
 */
export function mergeBaseOf(top: string, candidates: BaseCandidates): Pick<MergeToVerify, 'base' | 'baseFrom'> {
  const { ours, theirs, option, trailer } = candidates;

  if (option !== undefined) {
    return {
      base: knownCommit(top, option, 'Pass a commit, a branch or a tag: `--base <commit>`.'),
      baseFrom: 'option',
    };
  }

  const recorded = trailer === undefined ? undefined : commitOf(top, trailer);

  if (recorded !== undefined) {
    return { base: recorded, baseFrom: 'trailer' };
  }

  const base = runGit(top, ['merge-base', ours, theirs])?.trim();

  if (base === undefined || base === '') {
    throw new CliError(
      `${ours.slice(0, 7)} and ${theirs.slice(0, 7)} have no common ancestor: the merge has no base to compare with.`,
      'Name it: `--base <commit>`.',
    );
  }

  return { base, baseFrom: 'merge-base' };
}
