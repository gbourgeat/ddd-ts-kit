import fs from 'node:fs';
import { CliError } from '../cli-error';
import { gitPath } from './git-path';
import { gitProcess } from './git-process';
import { isMergePath } from './is-merge-path';
import type { MergeRepository } from './lost/merge-repository';
import { mergeRepositoryOf } from './lost/merge-repository-of';
import { mergeState } from './merge-state';
import { modifiedSinceStaged } from './modified-since-staged';

/**
 * `merge-trunk --abort`: undoes the merge in progress as `git merge --abort` does (the index and
 * the working tree back to HEAD) and forgets its state. Answers what it says.
 */
export function abortMerge(root: string): string {
  const repo = mergeRepositoryOf(root);
  const { top } = repo;

  if (!fs.existsSync(gitPath(top, 'MERGE_HEAD'))) {
    mergeState.remove(root);

    throw new CliError(
      'No merge is in progress in this worktree: nothing to abort.',
      'Run `git status` to see where the branch stands.',
    );
  }

  const discarded = undone(repo);

  mergeState.remove(root);

  const head = gitProcess(top, ['log', '-1', '--format=%h %s']).stdout.trim();
  const dropped = discarded.length === 0 ? '' : `\ndiscarded, the kit regenerates it: ${discarded.join(', ')}`;

  return `merge aborted: the branch is back at ${head}${dropped}${untrackedLeft(top)}`;
}

/** Runs `git merge --abort`, restoring first the regenerated files it refuses to overwrite; answers those it restored. */
function undone(repo: MergeRepository): readonly string[] {
  let aborted = gitProcess(repo.top, ['merge', '--abort']);
  let discarded: readonly string[] = [];

  if (aborted.status !== 0) {
    discarded = discardRegenerated(repo);
    aborted = discarded.length === 0 ? aborted : gitProcess(repo.top, ['merge', '--abort']);
  }

  if (aborted.status !== 0) {
    throw new CliError(
      `git merge --abort failed: ${aborted.stderr.trim() || 'no output'}.`,
      'Run `git reset --merge` to put the index and the working tree back to HEAD.',
    );
  }

  return discarded;
}

/**
 * Puts back the staged version of the files the kit regenerates that were modified after the merge
 * staged them, which `git merge --abort` refuses to overwrite. Refuses when any other tracked file
 * was modified: that is a change by hand, and it is never discarded.
 */
function discardRegenerated(repo: MergeRepository): readonly string[] {
  const modified = modifiedSinceStaged(repo);
  const mine = modified.filter((file) => !isMergePath(file, repo));

  if (mine.length > 0) {
    throw new CliError(
      `git merge --abort refused: ${mine.join(', ')} changed by hand since it was staged.`,
      'Commit, stash or restore those files, then run `npx ddd-ts-kit merge-trunk --abort` again.',
    );
  }

  if (modified.length > 0) {
    gitProcess(repo.top, ['--literal-pathspecs', 'checkout', '--', ...modified]);
  }

  return modified;
}

function untrackedLeft(top: string): string {
  const untracked = gitProcess(top, ['ls-files', '--others', '--exclude-standard', '-z'])
    .stdout.split('\0')
    .filter((file) => file !== '' && !/(?:^|\/)\.ddd-ts-kit\//.test(file));

  return untracked.length === 0
    ? ''
    : `\nuntracked files left (written during the merge, or yours): ${untracked.join(', ')}`;
}
