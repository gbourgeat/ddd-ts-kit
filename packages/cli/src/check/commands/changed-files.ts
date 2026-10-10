import { execFileSync } from 'node:child_process';
import { CliError } from '../../cli-error.js';

/** The files changed since `ref`, relative to the project root: the only place git is invoked, and only to read the user's own history. */
export function changedFiles(root: string, ref: string): Set<string> {
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--relative', `${ref}...`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const files = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    return new Set(files);
  } catch {
    throw new CliError(`Could not list the files changed since "${ref}".`, 'Check that the directory is a git repository and that the ref exists (fetch it in CI with enough history).');
  }
}
