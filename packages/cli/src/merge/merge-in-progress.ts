import fs from 'node:fs';
import { runGit } from '../commit/run-git';
import { gitPath } from './git-path';
import { mergeState } from './merge-state';

/**
 * One line for a person or an agent who comes back to a project while a merge is half done, or
 * undefined when none is: the branch, the trunk and the way on of `merge-trunk` when it started
 * the merge, only `--abort` (or git itself) when a merge is in progress and the kit holds no state of it.
 */
export function mergeInProgress(root: string): string | undefined {
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim();

  if (top === undefined || !fs.existsSync(gitPath(top, 'MERGE_HEAD'))) {
    return undefined;
  }

  const report = mergeState.read(root)?.report;

  if (report === undefined) {
    return 'Merge in progress, not started by merge-trunk: finish it with git, or undo it with `npx ddd-ts-kit merge-trunk --abort`.';
  }

  const left = report.forYou.length;

  return `Merge in progress: ${report.branch} <- ${report.trunk.ref}, ${left} ${left === 1 ? 'path' : 'paths'} left for you when it stopped: \`npx ddd-ts-kit merge-trunk --continue\` or \`--abort\`.`;
}
