import path from 'node:path';
import { runGit } from '../commit/run-git.js';

/** Where the worktrees of a project live: a folder of the project in its main checkout, ignored by git and by every tool. */
export const WORKTREES_DIR = '.worktrees';

/**
 * The worktree named `name` of the project at `root`: `.worktrees/<name>` in the project of the
 * main checkout, whichever worktree of the repository the command runs from, so that a worktree
 * opened from another one is not nested in it.
 */
export function worktreeHome(root: string, name: string): string {
  const common = runGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])?.trim();
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim() ?? root;
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '';
  const main = common !== undefined && path.basename(common) === '.git' ? path.dirname(common) : top;

  return path.join(main, prefix, WORKTREES_DIR, name);
}
