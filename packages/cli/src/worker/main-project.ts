import path from 'node:path';
import { runGit } from '../commit/run-git';

/** The project of the main checkout, whichever worktree of the repository `root` is in. */
export function mainProject(root: string): string {
  const common = runGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])?.trim();
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim() ?? root;
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '';
  const main = common !== undefined && path.basename(common) === '.git' ? path.dirname(common) : top;

  return path.join(main, prefix);
}
