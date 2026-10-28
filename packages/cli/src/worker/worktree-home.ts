import path from 'node:path';
import { mainProject } from './main-project';

/** Where the worktrees of a project live: a folder of the project in its main checkout, ignored by git and by every tool. */
export const WORKTREES_DIR = '.worktrees';

/**
 * The worktree named `name` of the project at `root`: `.worktrees/<name>` in the project of the
 * main checkout, whichever worktree of the repository the command runs from, so that a worktree
 * opened from another one is not nested in it.
 */
export function worktreeHome(root: string, name: string): string {
  return path.join(mainProject(root), WORKTREES_DIR, name);
}
