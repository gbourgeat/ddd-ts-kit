import fs from 'node:fs';
import { jsonObject } from '../init/json-object';
import type { WorkerFile } from './worker-file';

/** The scope file of a worker; undefined when it is missing, unreadable or names no context. What it lacks is left out. */
export function readWorkerFile(file: string): WorkerFile | undefined {
  const json = fs.existsSync(file) ? jsonObject(fs.readFileSync(file, 'utf8')) : undefined;
  const context = json?.context;

  if (json === undefined || typeof context !== 'string' || context === '') {
    return undefined;
  }

  const { rows, base, baseCommit, branch } = json;

  return {
    context,
    ...(Array.isArray(rows) ? { rows: rows.filter((id) => typeof id === 'string') } : {}),
    ...(typeof base === 'string' ? { base } : {}),
    ...(typeof baseCommit === 'string' ? { baseCommit } : {}),
    ...(typeof branch === 'string' ? { branch } : {}),
  };
}
