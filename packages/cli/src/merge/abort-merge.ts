import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { gitPath } from './git-path.js';
import { gitProcess } from './git-process.js';
import { mergeRepositoryOf } from './lost/merge-repository-of.js';
import { mergeState } from './merge-state.js';

/**
 * `merge-trunk --abort`: undoes the merge in progress as `git merge --abort` does (the index and
 * the working tree back to HEAD) and forgets its state. Answers what it says.
 */
export function abortMerge(root: string): string {
  const { top } = mergeRepositoryOf(root);

  if (!fs.existsSync(gitPath(top, 'MERGE_HEAD'))) {
    mergeState.remove(root);

    throw new CliError(
      'No merge is in progress in this worktree: nothing to abort.',
      'Run `git status` to see where the branch stands.',
    );
  }

  const aborted = gitProcess(top, ['merge', '--abort']);

  if (aborted.status !== 0) {
    throw new CliError(
      `git merge --abort failed: ${aborted.stderr.trim() || 'no output'}.`,
      'Run `git reset --merge` to put the index and the working tree back to HEAD.',
    );
  }

  mergeState.remove(root);

  const head = gitProcess(top, ['log', '-1', '--format=%h %s']).stdout.trim();

  const untracked = gitProcess(top, ['ls-files', '--others', '--exclude-standard', '-z'])
    .stdout.split('\0')
    .filter((file) => file !== '' && !/(?:^|\/)\.ddd-ts-kit\//.test(file));

  const left =
    untracked.length === 0
      ? ''
      : `\nuntracked files left (written during the merge, or yours): ${untracked.join(', ')}`;

  return `merge aborted: the branch is back at ${head}${left}`;
}
