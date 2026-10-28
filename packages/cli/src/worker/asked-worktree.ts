import path from 'node:path';
import { mainProject } from './main-project';
import { WORKTREES_DIR } from './worktree-home';

/**
 * The place a `--worktree` path names: a relative path under `.worktrees/` is the one of the main
 * checkout (the lines `plan-waves` prints work from any worktree), any other path is relative to
 * `root`.
 */
export function askedWorktree(root: string, asked: string): string {
  const [first] = path.normalize(asked).split(path.sep);

  return !path.isAbsolute(asked) && first === WORKTREES_DIR
    ? path.resolve(mainProject(root), asked)
    : path.resolve(root, asked);
}
