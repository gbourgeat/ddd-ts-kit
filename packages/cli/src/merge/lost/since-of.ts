import path from 'node:path';
import { WORKER_SCOPE_FILE } from '../../commit/worker-scope-file';
import { readWorkerFile } from '../../worker/read-worker-file';
import { commitOf } from '../../commit/commit-of';
import { knownCommit } from '../../commit/known-commit';

const TRUNKS = ['origin/HEAD', 'origin/main'];

/**
 * The ref the merges to check are listed from: `--since`, else the base of the worker of this
 * worktree (`.ddd-ts-kit/worker.json`), else origin/HEAD, else origin/main. Undefined when none
 * names a commit: only a merge in progress is checked then.
 */
export function sinceOf(root: string, top: string, explicit: string | undefined): string | undefined {
  if (explicit !== undefined) {
    knownCommit(top, explicit, 'Fetch it first, or pass the trunk: `--since origin/main`.');

    return explicit;
  }

  const worker = readWorkerFile(path.join(root, WORKER_SCOPE_FILE))?.base;

  return [...(worker === undefined ? [] : [worker]), ...TRUNKS].find((ref) => commitOf(top, ref) !== undefined);
}
