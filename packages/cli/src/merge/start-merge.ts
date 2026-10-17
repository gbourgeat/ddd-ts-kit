import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { gitPath } from './git-path.js';
import { gitProcess } from './git-process.js';
import type { MergePreview } from './preview-merge.js';

/** The merge to start: what merge-tree computed, the commit of the trunk, and the message of its commit. */
export interface MergeToStart {
  readonly preview: MergePreview;
  readonly trunk: string;
  readonly message: string;
}

const NO_OBJECT = '0'.repeat(40);

/**
 * Turns the tree merge-tree wrote into the merge git itself would leave in progress: the working
 * tree and the index take the tree, each conflicted path gets its three stages back (its file
 * keeps the diff3 markers), and MERGE_HEAD, MERGE_MODE and MERGE_MSG are written, so that
 * `git status`, `git add`, `git commit` and `git merge --abort` work on it as usual.
 */
export function startMerge(top: string, merge: MergeToStart): void {
  const { preview, trunk, message } = merge;

  run(top, ['update-ref', 'ORIG_HEAD', 'HEAD']);
  run(top, ['read-tree', '-u', '-m', 'HEAD', preview.tree]);

  const stages = [...preview.conflicts].flatMap(([file, entries]) => [
    `0 ${NO_OBJECT}\t${file}`,
    ...entries.map((entry) => `${entry.mode} ${entry.object} ${entry.stage}\t${file}`),
  ]);

  if (stages.length > 0) {
    run(top, ['update-index', '-z', '--index-info'], `${stages.join('\0')}\0`);
  }

  fs.writeFileSync(gitPath(top, 'MERGE_HEAD'), `${trunk}\n`);
  fs.writeFileSync(gitPath(top, 'MERGE_MODE'), 'no-ff');
  fs.writeFileSync(gitPath(top, 'MERGE_MSG'), message);
}

function run(top: string, args: readonly string[], input?: string): void {
  const answer = gitProcess(top, args, input);

  if (answer.status !== 0) {
    throw new CliError(
      `git ${args[0] ?? ''} failed while starting the merge: ${answer.stderr.trim() || 'no output'}.`,
      'A file the trunk adds may be in the way, untracked: move it aside, run `git reset --merge`, then merge-trunk again.',
    );
  }
}
