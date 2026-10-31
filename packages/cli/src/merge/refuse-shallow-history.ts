import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';

/**
 * Refuses a comparison of `ours` with `theirs` when a shallow clone left them no common commit: the
 * history that joins them is not in this clone, and git would answer with an empty base or an empty
 * range. A repository that is not shallow, or whose sides do share a commit, is left alone.
 */
export function refuseShallowHistory(top: string, { ours, theirs }: { ours: string; theirs: string }): void {
  const shared = runGit(top, ['merge-base', ours, theirs])?.trim() ?? '';

  if (shared !== '' || runGit(top, ['rev-parse', '--is-shallow-repository'])?.trim() !== 'true') {
    return;
  }

  throw new CliError(
    `This clone is shallow: ${ours} and ${theirs} share no commit in it, so there is no merge base to compare with.`,
    'Fetch the history that joins them: `git fetch --unshallow` (or a deeper `--depth`), then run this again.',
  );
}
