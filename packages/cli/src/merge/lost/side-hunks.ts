import { spawnSync } from 'node:child_process';
import type { Hunk } from './hunk';
import { hunksOf } from './hunks-of';
import { WORKTREE } from './revision-files';
import { gitArguments } from '../../commit/git-arguments';

/**
 * The hunks of each file changed from one commit to another, or to the working tree for
 * {@link WORKTREE}, by path from the top of the repository, read from one `git diff -U0`; empty
 * when git fails. A deleted file has no entry: its absence says it.
 */
export function sideHunks(top: string, from: string, to: string): Map<string, Hunk[]> {
  const revisions = to === WORKTREE ? [from] : [from, to];

  const run = spawnSync(
    'git',
    gitArguments(['diff', '-U0', '--no-renames', '--no-color', '--no-ext-diff', ...revisions]),
    {
      cwd: top,
      encoding: 'utf8',
      maxBuffer: 1 << 30,
    },
  );

  return run.status === 0 ? hunksOf(run.stdout) : new Map<string, Hunk[]>();
}
