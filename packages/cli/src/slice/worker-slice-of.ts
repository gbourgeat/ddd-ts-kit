import path from 'node:path';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import { readSlices } from '../progress/read-slices.js';
import { readWorkerFile } from '../worker/read-worker-file.js';
import { rowCommits } from '../worker/row-commits.js';
import { Workspace } from '../workspace/index.js';

/** The row a worker is closing, and the commit command that names it; neither once every row is committed. */
export interface WorkerSlice {
  /** The id of the row, as its scope file holds it. */
  readonly row?: string;
  /** `git commit -m "feat(<context>): <the slice>" -m "Slice: <id>"`. */
  readonly commit?: string;
}

/** Characters a double-quoted shell word would read: kept out of the subject. */
const SHELL_SPECIAL = /["`$\\]/g;

/**
 * In the worktree of a worker, the first row of its scope file that no commit of its branch
 * closes yet, with the commit command that closes it: the subject from the row's name, the
 * trailer `Slice: <id>` that `status --workers` reads. Undefined outside a worker; empty once
 * every row is committed.
 */
export function workerSliceOf(root: string, context: string, since: string): WorkerSlice | undefined {
  const scope = readWorkerFile(path.join(root, WORKER_SCOPE_FILE));

  if (scope?.rows === undefined || scope.context !== context) {
    return undefined;
  }

  const committed = new Set(
    rowCommits(root, { base: scope.base ?? since, context, rows: scope.rows }).map((done) => done.row),
  );

  const row = scope.rows.find((id) => !committed.has(id));

  if (row === undefined) {
    return {};
  }

  const name = readSlices(new Workspace(root, false))?.find((slice) => slice.id === row)?.slice;
  const subject = name === undefined ? '<the slice in business words>' : lowerFirst(name.replace(SHELL_SPECIAL, ''));

  return { row, commit: `git commit -m "feat(${context}): ${subject}" -m "Slice: ${row}"` };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
