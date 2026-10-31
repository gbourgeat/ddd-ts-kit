import { trunkExample } from '../commit/trunk-example';
import { CliError } from '../cli-error';
import { commitOf } from '../commit/commit-of';
import { knownCommit } from '../commit/known-commit';
import { runGit } from '../commit/run-git';

/** The commits a digest compares: HEAD, and where the branch forks from the base. */
export interface BranchPoints {
  readonly head: string;
  readonly baseCommit: string;
  /** The branch checked out, or `HEAD` when it is detached. */
  readonly branch: string;
}

/**
 * HEAD and the merge base of `base` and HEAD, so that a trunk that moved on since the branch was
 * cut adds nothing to the digest; refused outside a git repository, before the first commit, on a
 * ref git does not know, and on a ref that shares no history with HEAD.
 */
export function branchPoints(root: string, base: string): BranchPoints {
  if (runGit(root, ['rev-parse', '--is-inside-work-tree'])?.trim() !== 'true') {
    throw new CliError(
      `${root} is not inside a git repository.`,
      'Run it from the worktree of the branch, or pass --cwd <worktree>: the digest reads what the branch committed.',
    );
  }

  const head = commitOf(root, 'HEAD');

  if (head === undefined) {
    throw new CliError(
      'The repository has no commit yet.',
      'Commit the branch first: the digest reads what HEAD changes.',
    );
  }

  return { head, baseCommit: forkPoint(root, base, head), branch: branchOf(root) };
}

/** Where HEAD forks from the commit `base` names. */
function forkPoint(root: string, base: string, head: string): string {
  const named = knownCommit(
    root,
    base,
    `Fetch it first (\`git fetch origin\`), or name the base of the branch: \`--base ${trunkExample(root)}\`.`,
  );

  const fork = runGit(root, ['merge-base', '--end-of-options', named, head])?.trim();

  if (fork === undefined || fork === '') {
    throw new CliError(
      `${base} shares no history with HEAD.`,
      `Name the commit the branch was cut from: \`--base ${trunkExample(root)}\`, or the base of the story or of the briefing.`,
    );
  }

  return fork;
}

function branchOf(root: string): string {
  return runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() || 'HEAD';
}
