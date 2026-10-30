import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import type { LockHolder } from './lock-holder';
import { holderOf } from './holder-of';
import { isSameHolder } from './is-same-holder';

/**
 * Removes a stale lock, if it is still the one judged stale: moved aside in one step first, so that
 * of two commands taking it over, one only removes it, and never a lock taken again meanwhile.
 */
export function removeStale(lock: string, judged: LockHolder): void {
  if (!isSameHolder(holderOf(lock), judged)) {
    return;
  }

  const aside = `${lock}.${randomBytes(6).toString('hex')}.stale`;

  try {
    fs.renameSync(lock, aside);
  } catch {
    // Another command took it over first.
    return;
  }

  fs.rmSync(aside, { recursive: true, force: true });
}
