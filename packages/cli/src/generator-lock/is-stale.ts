import os from 'node:os';
import { errorCodeOf } from '../workspace/error-code-of';
import type { LockHolder } from './lock-holder';

/** A lock left behind: taken longer ago than `staleMs`, or by a process of this machine that has ended. */
export function isStale(holder: LockHolder, now: number, staleMs: number): boolean {
  return now - holder.startedAt > staleMs || hasEnded(holder);
}

function hasEnded({ pid, host }: LockHolder): boolean {
  if (pid === undefined || host !== os.hostname()) {
    return false;
  }

  try {
    process.kill(pid, 0);

    return false;
  } catch (error) {
    // EPERM: the process runs, under another user.
    return errorCodeOf(error) !== 'EPERM';
  }
}
