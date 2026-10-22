import { execFileSync } from 'node:child_process';
import { CliError } from '../../cli-error';

/**
 * The files changed since `ref`, relative to the project root: committed since the merge base,
 * modified in the working tree, and new files git does not track yet, which a generator has just
 * written and nothing has staged. The only place git is invoked, and only to read the user's own
 * history.
 */
export function changedFiles(root: string, ref: string): Set<string> {
  try {
    const changed = gitLines(root, ['diff', '--name-only', '--relative', `${ref}...`]);
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
