import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { errorCodeOf } from '../workspace/error-code-of';
import type { DiskWrites } from '../workspace/disk-writes';
import { HOLDER_FILE } from './holder-of';
import { removeMadeFolder } from './remove-made-folder';

/** The lock this command took, `held` while another command holds it, `unlockable` where no folder can be made. */
export type OwnLock =
  | { readonly folder: string; readonly lock: string; readonly startedAt: number; readonly made: boolean }
  | 'held'
  | 'unlockable';

/** Where the lock is taken, by which command, and the disk its holder file is written on. */
export interface LockPlace {
  readonly folder: string;
  readonly lock: string;
  readonly command: string;
  readonly disk: Pick<DiskWrites, 'writeFileSync'>;
}

/** One attempt at the lock: its folder made in one step, then the command that holds it written in it. */
export function ownLock(place: LockPlace): OwnLock {
  const { folder, lock } = place;
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

  return { folder, lock, startedAt: writeHolder(place, made), made };
}

/**
 * The holder file, written in the folder just made: when it cannot be written, the folder goes, the
 * kit folder too when this attempt made it, and the error is thrown, so that no lock stays behind
 * that names no command.
 */
function writeHolder({ folder, lock, command, disk }: LockPlace, made: boolean): number {
  const startedAt = Date.now();
  const holder = { command, pid: process.pid, host: os.hostname(), startedAt: new Date(startedAt).toISOString() };

  try {
    disk.writeFileSync(path.join(lock, HOLDER_FILE), `${JSON.stringify(holder, null, 2)}\n`);
  } catch (error) {
    fs.rmSync(lock, { recursive: true, force: true });

    removeMadeFolder(folder, made);

    throw error;
  }

  return startedAt;
}
