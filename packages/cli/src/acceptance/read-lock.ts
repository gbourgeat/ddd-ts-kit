import type { Workspace } from '../workspace';
import type { AcceptanceLock } from './acceptance-lock';
import { lockFileOf } from './lock-file-of';
import { lockIn } from './lock-in';

/** The lock of the story; undefined when it has none or the file is not a lock. */
export function readLock(ws: Workspace, story: string): AcceptanceLock | undefined {
  const text = ws.read(lockFileOf(story));

  if (text === undefined) {
    return undefined;
  }

  return lockIn(text, story);
}
