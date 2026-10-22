import path from 'node:path';
import { CliError } from '../../cli-error';
import { WORKER_SCOPE_FILE } from '../../commit/worker-scope-file';
import { readWorkerFile } from '../../worker/read-worker-file';
import { commitOf } from './commit-of';

const TRUNKS = ['origin/HEAD', 'origin/main'];

/**
 * The ref the merges to check are listed from: `--since`, else the base of the worker of this
 * worktree (`.ddd-ts-kit/worker.json`), else origin/HEAD, else origin/main. Undefined when none
 * names a commit: only a merge in progress is checked then.
 */
export function sinceOf(root: string, top: string, explicit: string | undefined): string | undefined {
  if (explicit !== undefined) {
    if (commitOf(top, explicit) === undefined) {
      throw new CliError(
        `${explicit} is not a commit of this repository.`,
        'Fetch it first, or pass the trunk: `--since origin/main`.',
      );
    }

    return explicit;
  }

  const worker = readWorkerFile(path.join(root, WORKER_SCOPE_FILE))?.base;

  return [...(worker === undefined ? [] : [worker]), ...TRUNKS].find((ref) => commitOf(top, ref) !== undefined);
}
