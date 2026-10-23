import { runGit } from '../commit/run-git';
import type { LandedAs } from '../merge/base-point';
import { gitVersion } from '../merge/git-version';
import { landedPoint } from '../merge/landed-point';
import { commitOf } from '../merge/lost/commit-of';
import { mergeRepositoryOf } from '../merge/lost/merge-repository-of';
import { previewMerge } from '../merge/preview-merge';

/** Where a worker's branch stands against its base, counted from what of it the base already holds. */
export interface BranchStanding {
  /** The commit its own work is counted from: where it landed, else its merge base with the base. */
  readonly since: string;
  /** The commit of the base that took the branch in (a squash), when one did; `since` is then the commit of the branch it took. */
  readonly landed?: LandedAs;
  /** Its commits since `since` the base does not have. */
  readonly ahead: number;
  /** The commits of the base it does not have. */
  readonly behind: number;
  /** What `merge-trunk` would leave conflicted now: the conflicted files of its own diff against the base. */
  readonly mergePreview?: { readonly conflicts: number; readonly files: readonly string[] };
}

/**
 * The standing of the branch of `worktree` (its project at `project`) against `base`: a branch
 * squash-merged into its base counts nothing more ahead, and its files are no longer changes of
 * its own. Undefined when the base names no commit.
 */
export function branchStanding(worktree: string, project: string, base: string): BranchStanding | undefined {
  const ends = endsOf(worktree, base);

  if (ends === undefined) {
    return undefined;
  }

  const { trunk, head, fork } = ends;
  const point = landedPoint({ root: project, repo: mergeRepositoryOf(project), head, trunk });
  const since = point.evidence === 'landed' ? point.commit : fork;

  const count = (range: readonly string[]): number =>
    Number(runGit(worktree, ['rev-list', '--count', ...range])?.trim() ?? '0');

  const behind = count([`${head}..${trunk}`]);

  return {
    since,
    ...(point.evidence === 'landed' && point.landedAs !== undefined ? { landed: point.landedAs } : {}),
    ahead: count([`${since}..${head}`, '--not', trunk]),
    behind,
    ...(behind > 0 && gitVersion(worktree).mergeBase ? previewOf(worktree, { since, trunk }) : {}),
  };
}

/** The commit of the base, of HEAD, and their merge base; undefined when one is missing. */
function endsOf(worktree: string, base: string): { trunk: string; head: string; fork: string } | undefined {
  const trunk = commitOf(worktree, base);
  const head = commitOf(worktree, 'HEAD');

  const fork =
    trunk === undefined || head === undefined ? '' : (runGit(worktree, ['merge-base', trunk, head])?.trim() ?? '');

  return trunk === undefined || head === undefined || fork === '' ? undefined : { trunk, head, fork };
}

/** Nothing when git cannot compute it: the standing is read, never refused. */
function previewOf(
  worktree: string,
  { since, trunk }: { since: string; trunk: string },
): { mergePreview?: NonNullable<BranchStanding['mergePreview']> } {
  try {
    const files = [...previewMerge(worktree, { base: since, ours: 'HEAD', theirs: trunk }).conflicts.keys()];

    return { mergePreview: { conflicts: files.length, files } };
  } catch {
    return {};
  }
}
