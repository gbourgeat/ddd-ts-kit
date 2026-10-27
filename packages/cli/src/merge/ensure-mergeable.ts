import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { gitPath } from './git-path';
import { gitProcess } from './git-process';
import { isSandboxMask } from './is-sandbox-mask';

/** What git leaves in its directory while an operation waits for a person, and its name. */
const OPERATIONS: readonly (readonly [string, string])[] = [
  ['MERGE_HEAD', 'a merge'],
  ['CHERRY_PICK_HEAD', 'a cherry-pick'],
  ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'],
  ['rebase-apply', 'a rebase or an am'],
];

/**
 * Refuses to start a merge on a working tree that is not clean (the kit's own folder aside),
 * while another operation waits (the merge would mix with work that is not the trunk's), or
 * where git knows no committer (its commit would fail once the merge is in progress).
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

  ensureCommitter(top);

  const changed = gitProcess(top, ['status', '--porcelain', '-z', '--untracked-files=all'])
    .stdout.split('\0')
    .filter((entry) => /^.. /.test(entry))
    .filter((entry) => !maskedUntracked(top, entry))
    .map((entry) => entry.slice(3))
    .filter((file) => !/(?:^|\/)\.ddd-ts-kit\//.test(file));

  if (changed.length > 0) {
    throw new CliError(
      `The working tree is not clean: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` and ${changed.length - 5} more` : ''}.`,
      'Commit the work (one slice, one commit), or set it aside in a commit of its own, then merge-trunk again: a merge mixed with uncommitted work cannot be checked.',
    );
  }
}

/** The merge ends with a commit: without a committer git refuses it, after the merge has started. */
function ensureCommitter(top: string): void {
  const ident = gitProcess(top, ['var', 'GIT_COMMITTER_IDENT']);

  if (ident.status !== 0) {
    throw new CliError(
      `git does not know who commits in this repository: ${ident.stderr.trim().split('\n').at(-1) ?? 'no identity'}.`,
      'Set it first (`git config user.name "<name>"` and `git config user.email "<email>"`), then merge-trunk again: the merge ends with a commit.',
    );
  }
}

/** An untracked path that is such a mask: git lists it, nobody wrote it and nobody can commit it. */
function maskedUntracked(top: string, entry: string): boolean {
  if (!entry.startsWith('?? ')) {
    return false;
  }

  try {
    return isSandboxMask(fs.lstatSync(path.join(top, entry.slice(3))));
  } catch {
    return false;
  }
}
