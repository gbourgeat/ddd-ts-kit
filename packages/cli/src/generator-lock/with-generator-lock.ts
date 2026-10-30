import fs from 'node:fs';
import path from 'node:path';
import { heldLockRefusal } from './held-lock-refusal';
import { holderOf } from './holder-of';
import { isStale } from './is-stale';
import type { LockTiming } from './lock-timing';
import { ownLock, type OwnLock } from './own-lock';
import { removeStale } from './remove-stale';

const KIT_FOLDER = '.ddd-ts-kit';

/** The lock of the project at `root`, asked by `command` (its line, as the refusal of another names it). */
interface LockRequest {
  readonly root: string;
  readonly command: string;
  readonly timing?: LockTiming;
}

/** About five seconds of waiting, a look every tenth of a second, a lock taken more than a minute ago taken over. */
const LOCK_TIMING: LockTiming = { waitMs: 5000, pollMs: 100, staleMs: 60_000 };

/**
 * Runs `run` while this command holds the lock of the project, `.ddd-ts-kit/lock`, so that a command
 * that reads the shared files (the config, the composition root, the code lists and permission sets,
 * the barrels) and writes them back never loses what another wrote in between. The lock is a folder,
 * made in one step on every platform, holding the command line, the pid and the start instant. A
 * lock another command holds is waited for, one whose command has ended or that was taken more than
 * a minute ago is taken over, and the command is refused once the wait is over. A `.ddd-ts-kit` that
 * is a link, or that this process cannot write, holds no lock: the command runs as it would without.
 */
export function withGeneratorLock<T>({ root, command, timing = LOCK_TIMING }: LockRequest, run: () => T): T {
  const release = takeLock(path.join(root, KIT_FOLDER), command, timing);

  try {
    return run();
  } finally {
    release();
  }
}

/** The lock taken, waited for or taken over: what releases it, or a refusal naming who holds it. */
function takeLock(folder: string, command: string, timing: LockTiming): () => void {
  if (fs.lstatSync(folder, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
    return () => undefined;
  }

  const lock = path.join(folder, 'lock');
  const deadline = Date.now() + timing.waitMs;
  let taken = ownLock(folder, lock, command);

  while (taken === 'held') {
    waitOrTakeOver(lock, timing, deadline);
    taken = ownLock(folder, lock, command);
  }

  const owned = taken;

  return owned === 'unlockable' ? () => undefined : () => release(owned);
}

/** One look at the lock another holds: taken over when stale, else waited for until the deadline. */
function waitOrTakeOver(lock: string, timing: LockTiming, deadline: number): void {
  const holder = holderOf(lock);

  if (holder === undefined) {
    // Released between the attempt and this look: the next attempt takes it.
    return;
  }

  if (isStale(holder, Date.now(), timing.staleMs)) {
    removeStale(lock, holder);

    return;
  }

  if (Date.now() >= deadline) {
    throw heldLockRefusal(holder, Date.now());
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, timing.pollMs);
}

/** The lock removed, if it is still this command's own (not taken over meanwhile), and the kit folder if the lock made it. */
function release({ folder, lock, startedAt, made }: Exclude<OwnLock, 'held' | 'unlockable'>): void {
  if (holderOf(lock)?.startedAt === startedAt && holderOf(lock)?.pid === process.pid) {
    fs.rmSync(lock, { recursive: true, force: true });
  }

  if (made) {
    try {
      fs.rmdirSync(folder);
    } catch {
      // Not empty: another command holds the lock now, or the kit keeps other files there.
    }
  }
}
