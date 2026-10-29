import { CliError } from '../cli-error';
import { commitOf } from './commit-of';

/**
 * The full hash of the commit a ref the user gave names, which is what reaches the other git
 * commands; refused when it names none.
 */
export function knownCommit(directory: string, ref: string, fix: string): string {
  const commit = commitOf(directory, ref);

  if (commit === undefined) {
    throw new CliError(`${ref} is not a commit of this repository.`, fix);
  }

  return commit;
}
