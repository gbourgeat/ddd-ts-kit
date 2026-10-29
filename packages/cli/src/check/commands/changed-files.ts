import { execFileSync } from 'node:child_process';
import { CliError } from '../../cli-error';
import { knownCommit } from '../../commit/known-commit';

/**
 * The files changed since `ref`, relative to the project root: committed since the merge base,
 * tracked files modified in the index or the working tree (committed or not), and new files git does not track yet, which a generator has just
 * written and nothing has staged. The only place git is invoked, and only to read the user's own
 * history. A `ref` that names no commit is refused: what changed since it cannot be told.
 */
export function changedFiles(root: string, ref: string): Set<string> {
  const commit = knownCommit(
    root,
    ref,
    'Run it in a git repository and name a branch, a tag or a commit git knows (`git fetch origin` first in CI, with enough history): `--changed-since origin/main`.',
  );

  try {
    const [base = commit] = gitLines(root, ['merge-base', commit, 'HEAD']);
    const changed = gitLines(root, ['diff', '--name-only', '--relative', base]);
    const untracked = gitLines(root, ['ls-files', '--others', '--exclude-standard']);

    return new Set([...changed, ...untracked]);
  } catch {
    throw new CliError(
      `Could not list the files changed since "${ref}".`,
      'Check that the directory is a git repository and that the ref exists (fetch it in CI with enough history).',
    );
  }
}

function gitLines(root: string, args: readonly string[]): string[] {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
