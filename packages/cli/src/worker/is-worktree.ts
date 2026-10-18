import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { listWorktrees } from './list-worktrees.js';

/** True when the directory is a worktree of the repository; false when it does not exist; refused when it is anything else. */
export function isWorktree(root: string, worktree: string): boolean {
  if (!fs.existsSync(worktree)) {
    return false;
  }

  const known = listWorktrees(root).map((listed) => listed.path);

  if (known.includes(fs.realpathSync(worktree))) {
    return true;
  }

  throw new CliError(
    `${worktree} exists and is not a worktree of this repository.`,
    'Pass another directory with --worktree <path>, or remove that one.',
  );
}
