import fs from 'node:fs';
import path from 'node:path';
import type { DiskWrites } from '../workspace/disk-writes';
import { KIT_FOLDER, LOCK_FOLDER } from '../workspace/kit-folder';
import { heldLockRefusal } from './held-lock-refusal';
import { holderOf } from './holder-of';
import { isSameHolder } from './is-same-holder';
import { isStale } from './is-stale';
import type { LockTiming } from './lock-timing';
import { ownLock, type LockPlace, type OwnLock } from './own-lock';
import { removeMadeFolder } from './remove-made-folder';
import { removeStale } from './remove-stale';
import { unreadableLockRefusal } from './unreadable-lock-refusal';

/**
 * The lock of the project at `root`, asked by `command` (its line, as the refusal of another names
 * it); `disk` writes its holder file, which a spec replaces to make that write fail.
 */
interface LockRequest {
  readonly root: string;
  readonly command: string;
  readonly timing?: LockTiming;
  readonly disk?: Pick<DiskWrites, 'writeFileSync'>;
}

/** About five seconds of waiting, a look every tenth of a second, a lock of another machine taken over after a minute. */
const LOCK_TIMING: LockTiming = { waitMs: 5000, pollMs: 100, staleMs: 60_000 };

/**
 * Runs `run` while this command holds the lock of the project, `.ddd-ts-kit/lock`, so that a command
 * that reads the shared files (the config, the composition root, the code lists and permission sets,
 * the barrels) and writes them back never loses what another wrote in between. The lock is a folder,
 * made in one step on every platform, holding the command line, the pid and the start instant. A
 * lock another command holds is waited for, one left behind (`isStale`) is taken over, and the
 * command is refused once the wait is over. A `.ddd-ts-kit` that is a link, or that this process
 * cannot write, holds no lock: the command runs as it would without.
 */
export function withGeneratorLock<T>({ root, command, timing = LOCK_TIMING, disk = fs }: LockRequest, run: () => T): T {
  const place = { folder: path.join(root, KIT_FOLDER), lock: path.join(root, LOCK_FOLDER), command, disk };
  const release = takeLock(place, timing);

  try {
    return run();
  } finally {
    release();
  }
}

/** The lock taken, waited for or taken over: what releases it, or a refusal naming who holds it. */
function takeLock(place: LockPlace, timing: LockTiming): () => void {
  if (fs.lstatSync(place.folder, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
    return () => undefined;
  }

  const deadline = Date.now() + timing.waitMs;
  let taken = ownLock(place);

  while (taken === 'held') {
    waitOrTakeOver(place.lock, timing, deadline);
    taken = ownLock(place);
  }

  const owned = taken;

  return owned === 'unlockable' ? () => undefined : () => release(owned);
}

/**
 * One look at the lock another holds: taken over when stale, else waited for until the deadline. A
 * lock that reads as nothing was released since the attempt, or is a link to nothing, which no
 * attempt will ever take: the deadline holds for both.
 */
function waitOrTakeOver(lock: string, timing: LockTiming, deadline: number): void {
  const holder = holderOf(lock);

  if (holder !== undefined && isStale(holder, Date.now(), timing.staleMs)) {
    removeStale(lock, holder);

    return;
  }

  if (Date.now() >= deadline) {
    throw holder === undefined ? unreadableLockRefusal() : heldLockRefusal(holder, Date.now());
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, timing.pollMs);
}

/** The lock removed, if it is still this command's own (not taken over meanwhile), and the kit folder if the lock made it. */
function release({ folder, lock, startedAt, made }: Exclude<OwnLock, 'held' | 'unlockable'>): void {
  if (isSameHolder(holderOf(lock), { startedAt, pid: process.pid })) {
    fs.rmSync(lock, { recursive: true, force: true });
  }

  removeMadeFolder(folder, made);
}
