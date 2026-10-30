import { CliError } from '../cli-error';
import { LOCK_FOLDER } from '../workspace/kit-folder';

/** The refusal of a command that waited as long as it waits for a lock that stands there and reads as nothing. */
export function unreadableLockRefusal(): CliError {
  return new CliError(
    `${LOCK_FOLDER} stands there and cannot be read, a link to nothing for one. This command waited for it and wrote nothing.`,
    `Remove ${LOCK_FOLDER} and run the command again.`,
  );
}
