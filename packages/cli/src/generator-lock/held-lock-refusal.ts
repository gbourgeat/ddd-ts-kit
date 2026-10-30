import { CliError } from '../cli-error';
import type { LockHolder } from './lock-holder';

/** The lock, as the refusal names it for the person who removes it by hand. */
const LOCK = '.ddd-ts-kit/lock';

/** The refusal of a command that waited for the lock as long as it waits: exit code 2, the other command named. */
export function heldLockRefusal(holder: LockHolder, now: number): CliError {
  return new CliError(
    `Another generator holds the lock of this project: ${holderText(holder, now)}. This command waited for it and wrote nothing.`,
    `Run the generators one after the other: run this command again once that one has ended. A lock whose command has ended is taken over, and so is one taken more than a minute ago; to take it at once, remove ${LOCK}.`,
  );
}

function holderText({ command, pid, startedAt }: LockHolder, now: number): string {
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  const started = `started ${seconds} second${seconds === 1 ? '' : 's'} ago`;

  return command === undefined
    ? `a command that has not written its name in ${LOCK} yet (${started})`
    : `\`${command}\` (${pid === undefined ? '' : `pid ${pid}, `}${started})`;
}
