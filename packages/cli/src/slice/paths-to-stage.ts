import { runGit } from '../commit/run-git.js';

/**
 * The paths a slice leaves to commit, modified or new, as `git add <path>` takes them one by one;
 * the kit's own working files (`.ddd-ts-kit/`) are left out.
 */
export function pathsToStage(root: string): string[] {
  return (runGit(root, ['status', '--porcelain', '--untracked-files=all']) ?? '')
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).replace(/^.* -> /, ''))
    .filter((file) => !file.startsWith('.ddd-ts-kit/'));
}
