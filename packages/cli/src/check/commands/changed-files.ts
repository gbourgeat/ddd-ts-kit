import { execFileSync } from 'node:child_process';
import { CliError } from '../../cli-error';
import { gitArguments } from '../../commit/git-arguments';

/**
 * The files changed since `commit`, the commit a ref the caller checked names, relative to the
 * project root: committed since the merge base, tracked files modified in the index or the
 * working tree (committed or not), and new files git does not track yet, which a generator has
 * just written and nothing has staged. Git is invoked here only to read the user's own history.
 */
export function changedFiles(root: string, commit: string): Set<string> {
  try {
    const [base = commit] = gitLines(root, ['merge-base', commit, 'HEAD']);
    const changed = gitLines(root, ['diff', '--name-only', '--relative', base]);
    const untracked = gitLines(root, ['ls-files', '--others', '--exclude-standard']);

    return new Set([...changed, ...untracked]);
  } catch {
    throw new CliError(
      `Could not list the files changed since ${commit.slice(0, 7)}.`,
      'Check that the directory is a git repository and that the ref exists (fetch it in CI with enough history).',
    );
  }
}

function gitLines(root: string, args: readonly string[]): string[] {
  return execFileSync('git', gitArguments(args), { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
