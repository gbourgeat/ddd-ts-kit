import { runGit } from '../commit/run-git';

/** Where the project stands in its repository: the folder under the top, when it is not the top itself. */
export function subfolderOf(root: string): string | undefined {
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim().replace(/\/$/, '');

  return prefix === undefined || prefix === '' ? undefined : prefix;
}
