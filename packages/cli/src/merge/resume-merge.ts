import fs from 'node:fs';
import { CliError } from '../cli-error';
import { continueMerge, type ContinueOptions } from './continue-merge';
import { gitPath } from './git-path';
import { commitOf } from '../commit/commit-of';
import { mergeContextOf } from './merge-context';
import type { MergeReport } from './merge-report';
import { type MergeState, mergeState } from './merge-state';

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
        ? 'A merge is in progress, and nothing records the base merge-trunk merged from.'
        : 'No merge of merge-trunk is in progress in this worktree.',
      merging
        ? 'Undo it with `npx ddd-ts-kit merge-trunk --abort` and run `npx ddd-ts-kit merge-trunk` again; or, for a merge you made with git, finish it with `git commit`, then `npx ddd-ts-kit verify-merge`.'
        : 'Run `npx ddd-ts-kit merge-trunk` to start one.',
    );
  }

  return continueMerge(context, withTrunkMoved(context.repo.top, state), options);
}

/** The merge in progress concludes the trunk commit of its first run: when the ref names another commit now, the report says so. */
function withTrunkMoved(top: string, state: MergeState): MergeState {
  const { ref, commit } = state.report.trunk;
  const now = commitOf(top, ref);

  return now === undefined || now === commit
    ? state
    : { ...state, report: { ...state.report, trunkMoved: { merged: commit, now } } };
}
