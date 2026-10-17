import { CliError } from '../../cli-error.js';
import { runGit } from '../../commit/run-git.js';
import { WORKTREE } from './revision-files.js';

/**
 * The paths that differ between each pair of revisions, from the top of the repository, sorted;
 * with {@link WORKTREE} as the second of a pair, the index and the working tree, untracked files
 * included. Renames count as a deletion and an addition: both paths are read.
 */
export function changedPaths(top: string, pairs: ReadonlyArray<readonly [string, string]>): string[] {
  const paths = pairs.flatMap(([from, to]) =>
    to === WORKTREE
      ? [
          ...listed(top, ['diff', '--name-only', '-z', '--no-renames', from]),
          ...listed(top, ['ls-files', '-z', '--others', '--exclude-standard']),
        ]
      : listed(top, ['diff', '--name-only', '-z', '--no-renames', from, to]),
  );

  return [...new Set(paths)].sort();
}

function listed(top: string, args: readonly string[]): string[] {
  const output = runGit(top, args);

  if (output === undefined) {
    throw new CliError(
      `git could not run \`git ${args.join(' ')}\`.`,
      'Check that the commits of the merge are in this clone (a shallow clone lacks them: fetch with --unshallow).',
    );
  }

  return output.split('\0').filter((file) => file !== '');
}
