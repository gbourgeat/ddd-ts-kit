import { execFileSync } from 'node:child_process';
import type { BaselineMove } from './baseline-move';
import { BASELINE_FILE } from './read-baseline';
import { gitArguments } from '../../commit/git-arguments';

/**
 * The files git sees renamed since the baseline was last committed, staged and committed renames
 * alike (a `git mv`, or a move git recognises from the content), relative to the project root.
 * Outside a repository, nothing.
 */
export function renamedFiles(root: string): BaselineMove[] {
  try {
    const base = git(root, ['log', '-1', '--format=%H', '--', BASELINE_FILE]).trim() || 'HEAD';

    return git(root, ['diff', '-M', '--name-status', '--relative', '--diff-filter=R', base])
      .split('\n')
      .map((line) => line.split('\t'))
      .flatMap(([status, from, to]) => (status?.startsWith('R') && from && to ? [{ from, to }] : []));
  } catch {
    return [];
  }
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', gitArguments(args), { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
