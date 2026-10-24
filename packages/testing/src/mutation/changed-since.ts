import { spawnSync } from 'node:child_process';

/**
 * The files of the project changed since the git ref, relative to the project root: committed
 * since it, modified, and untracked but not ignored. Nothing when git cannot say: not a
 * repository, or a ref it does not know.
 */
export function changedSince(root: string, ref: string): string[] | undefined {
  const committed = git(root, ['diff', '--name-only', '--relative', '-z', ref]);

  if (committed === undefined) {
    return undefined;
  }

  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']) ?? '';

  return [...new Set([...committed.split('\0'), ...untracked.split('\0')].filter((file) => file !== ''))];
}

function git(root: string, args: readonly string[]): string | undefined {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  return run.status === 0 ? run.stdout : undefined;
}
