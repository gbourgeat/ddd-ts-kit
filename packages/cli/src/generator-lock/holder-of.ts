import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import type { LockHolder } from './lock-holder';

/** The file the command that takes the lock writes in its folder. */
export const HOLDER_FILE = 'holder.json';

/**
 * Who holds the lock of the folder `lock`: what its file says, or (a holder that has not written it
 * yet, a file that is not JSON) the instant of the folder alone; undefined once the folder is gone.
 */
export function holderOf(lock: string): LockHolder | undefined {
  const folder = statOf(lock);

  return folder === undefined ? undefined : { startedAt: folder.mtimeMs, ...recorded(path.join(lock, HOLDER_FILE)) };
}

function statOf(lock: string): fs.Stats | undefined {
  try {
    return fs.statSync(lock);
  } catch {
    return undefined;
  }
}

function recorded(file: string): Partial<LockHolder> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));

    return isRecord(parsed) ? fieldsOf(parsed) : {};
  } catch {
    return {};
  }
}

function fieldsOf({ command, pid, host, startedAt }: Record<string, unknown>): Partial<LockHolder> {
  const started = typeof startedAt === 'string' ? Date.parse(startedAt) : Number.NaN;

  return {
    ...(typeof command === 'string' ? { command } : {}),
    ...(typeof pid === 'number' ? { pid } : {}),
    ...(typeof host === 'string' ? { host } : {}),
    ...(Number.isNaN(started) ? {} : { startedAt: started }),
  };
}
