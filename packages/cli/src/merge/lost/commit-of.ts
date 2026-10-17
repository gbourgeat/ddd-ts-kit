import { runGit } from '../../commit/run-git.js';

/** The full hash of the commit `ref` names; undefined when it names none. */
export function commitOf(top: string, ref: string): string | undefined {
  return runGit(top, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])?.trim() || undefined;
}
