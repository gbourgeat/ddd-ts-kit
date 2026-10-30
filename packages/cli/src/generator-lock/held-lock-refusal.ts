import { CliError } from '../cli-error';
import { LOCK_FOLDER } from '../workspace/kit-folder';
import type { LockHolder } from './lock-holder';

/** The refusal of a command that waited for the lock as long as it waits: exit code 2, the other command named. */
export function heldLockRefusal(holder: LockHolder, now: number): CliError {
  return new CliError(
    `Another generator holds the lock of this project: ${holderText(holder, now)}. This command waited for it and wrote nothing.`,
    `Run the generators one after the other: run this command again once that one has ended. A lock taken on this machine is kept while its command runs and taken over once it has ended; one taken on another machine, or whose holder cannot be read, is taken over a minute after it was taken. To take it at once, remove ${LOCK_FOLDER}.`,
  );
}

function holderText({ command, pid, startedAt }: LockHolder, now: number): string {
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  const started = `started ${seconds} second${seconds === 1 ? '' : 's'} ago`;

  return command === undefined
    ? `a command that has not written its name in ${LOCK_FOLDER} yet (${started})`
    : `\`${command}\` (${pid === undefined ? '' : `pid ${pid}, `}${started})`;
}
