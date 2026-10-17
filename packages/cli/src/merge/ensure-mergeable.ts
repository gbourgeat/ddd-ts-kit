import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { gitPath } from './git-path.js';
import { gitProcess } from './git-process.js';

/** What git leaves in its directory while an operation waits for a person, and its name. */
const OPERATIONS: readonly (readonly [string, string])[] = [
  ['MERGE_HEAD', 'a merge'],
  ['CHERRY_PICK_HEAD', 'a cherry-pick'],
  ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'],
  ['rebase-apply', 'a rebase or an am'],
];

/**
 * Refuses to start a merge on a working tree that is not clean (the kit's own folder aside) or
 * while another operation waits: the merge would mix with work that is not the trunk's.
 */
export function ensureMergeable(top: string, mergeTrunkInProgress: boolean): void {
  const waiting = OPERATIONS.find(([file]) => fs.existsSync(gitPath(top, file)));

  if (waiting !== undefined) {
    throw new CliError(
      `${waiting[1]} is in progress in this worktree.`,
      mergeTrunkInProgress && waiting[0] === 'MERGE_HEAD'
        ? 'It is the merge of merge-trunk: settle what it lists, then `npx ddd-ts-kit merge-trunk --continue`, or `npx ddd-ts-kit merge-trunk --abort`.'
        : 'Finish it or abort it first (`git merge --abort`, `git rebase --abort`, `git cherry-pick --abort`), then merge-trunk again.',
    );
  }

  const changed = gitProcess(top, ['status', '--porcelain', '-z', '--untracked-files=all'])
    .stdout.split('\0')
    .filter((entry) => /^.. /.test(entry))
    .map((entry) => entry.slice(3))
    .filter((file) => !/(?:^|\/)\.ddd-ts-kit\//.test(file));

  if (changed.length > 0) {
    throw new CliError(
      `The working tree is not clean: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` and ${changed.length - 5} more` : ''}.`,
      'Commit the work (one slice, one commit), or set it aside in a commit of its own, then merge-trunk again: a merge mixed with uncommitted work cannot be checked.',
    );
  }
}
