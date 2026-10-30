import os from 'node:os';
import { errorCodeOf } from '../workspace/error-code-of';
import type { LockHolder } from './lock-holder';

/**
 * A lock left behind. Taken by a process of this machine, it is stale once that process has
 * ended, and kept as long as it runs, however long it takes. Taken on another machine, or by a
 * holder whose file cannot be read, nothing says whether it runs: the lock is stale once it was
 * taken longer ago than `staleMs`.
 */
export function isStale(holder: LockHolder, now: number, staleMs: number): boolean {
  return holder.pid !== undefined && holder.host === os.hostname()
    ? hasEnded(holder.pid)
    : now - holder.startedAt > staleMs;
}

function hasEnded(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return false;
  } catch (error) {
    // EPERM: the process runs, under another user.
    return errorCodeOf(error) !== 'EPERM';
  }
}
