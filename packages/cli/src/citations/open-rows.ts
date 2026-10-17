import path from 'node:path';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { Slice } from '../progress/slice.js';
import { readWorkerFile } from '../worker/read-worker-file.js';

/** The ids of the rows not done, without those the worker of this worktree builds (its scope file names them). */
export function openRows(root: string, slices: readonly Slice[]): Set<string> {
  const own = readWorkerFile(path.join(root, WORKER_SCOPE_FILE))?.rows ?? [];

  return new Set(slices.filter((row) => row.status !== 'done' && !own.includes(row.id)).map((row) => row.id));
}
