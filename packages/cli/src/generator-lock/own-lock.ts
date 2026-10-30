import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { errorCodeOf } from '../workspace/error-code-of';
import { HOLDER_FILE } from './holder-of';

/** The lock this command took, `held` while another command holds it, `unlockable` where no folder can be made. */
export type OwnLock =
  | { readonly folder: string; readonly lock: string; readonly startedAt: number; readonly made: boolean }
  | 'held'
  | 'unlockable';

/** One attempt at the lock: its folder made in one step, then the command that holds it written in it. */
export function ownLock(folder: string, lock: string, command: string): OwnLock {
  const made = !fs.existsSync(folder);

  try {
    fs.mkdirSync(folder, { recursive: true });
  } catch {
    return 'unlockable';
  }

  try {
    fs.mkdirSync(lock);
  } catch (error) {
    // ENOENT: the kit folder was removed by a command releasing its lock, between the two steps.
    return ['EEXIST', 'ENOENT'].includes(errorCodeOf(error) ?? '') ? 'held' : 'unlockable';
  }

  const startedAt = Date.now();
  const holder = { command, pid: process.pid, host: os.hostname(), startedAt: new Date(startedAt).toISOString() };

  fs.writeFileSync(path.join(lock, HOLDER_FILE), `${JSON.stringify(holder, null, 2)}\n`);

  return { folder, lock, startedAt, made };
}
