import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { continueMerge, type ContinueOptions } from './continue-merge.js';
import { gitPath } from './git-path.js';
import { mergeContextOf } from './merge-context.js';
import type { MergeReport } from './merge-report.js';
import { mergeState } from './merge-state.js';

/** `merge-trunk --continue`: goes on with the merge merge-trunk left in progress in the project at `root`. */
export function resumeMerge(root: string, options: ContinueOptions): MergeReport {
  const context = mergeContextOf(root);
  const state = mergeState.read(root);
  const merging = fs.existsSync(gitPath(context.repo.top, 'MERGE_HEAD'));

  if (state === undefined || !merging) {
    if (state !== undefined) {
      mergeState.remove(root);
    }

    throw new CliError(
      merging
        ? 'The merge in progress was not started by merge-trunk: nothing records its base.'
        : 'No merge of merge-trunk is in progress in this worktree.',
      merging
        ? 'Finish it with git (`git commit`, then `npx ddd-ts-kit verify-merge`), or `git merge --abort` and run `npx ddd-ts-kit merge-trunk`.'
        : 'Run `npx ddd-ts-kit merge-trunk` to start one.',
    );
  }

  return continueMerge(context, state, options);
}
