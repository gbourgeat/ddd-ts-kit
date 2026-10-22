import { runGit } from '../commit/run-git';

/** One worktree of the repository, as `git worktree list --porcelain` prints it. */
export interface Worktree {
  /** Absolute path of the worktree. */
  readonly path: string;
  /** The branch checked out, without `refs/heads/`; undefined on a detached HEAD. */
  readonly branch?: string;
}

/** The worktrees of the repository `root` belongs to, the main one first; none outside a repository. Bare ones are left out. */
export function listWorktrees(root: string): Worktree[] {
  const blocks = (runGit(root, ['worktree', 'list', '--porcelain']) ?? '').split(/\n\n+/);

  return blocks.flatMap((block) => {
    const lines = block.split('\n');
    const worktree = valueOf(lines, 'worktree');
    const branch = valueOf(lines, 'branch')?.replace(/^refs\/heads\//, '');

    if (worktree === undefined || lines.includes('bare')) {
      return [];
    }

    return [{ path: worktree, ...(branch === undefined ? {} : { branch }) }];
  });
}

function valueOf(lines: readonly string[], key: string): string | undefined {
  return lines.find((line) => line.startsWith(`${key} `))?.slice(key.length + 1);
}
