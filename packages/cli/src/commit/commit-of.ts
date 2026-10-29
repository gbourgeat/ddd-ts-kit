import { runGit } from './run-git';

/**
 * The full hash of the commit `ref` names; undefined when it names none. `--end-of-options` keeps
 * a value that starts with a dash, `--output=<file>` say, from being read as an option of git.
 */
export function commitOf(directory: string, ref: string): string | undefined {
  return (
    runGit(directory, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`])?.trim() || undefined
  );
}
