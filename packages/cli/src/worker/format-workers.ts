import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { WorkerStatus, WorkersStatus } from './workers-status.js';

/** `status --workers` for a reader: each worker and what it changed, then where two workers meet. */
export function formatWorkers(status: WorkersStatus): string {
  const { workers, overlaps } = status;

  if (workers.length === 0) {
    return `No worker: no worktree of this repository holds ${WORKER_SCOPE_FILE} (\`npx ddd-ts-kit worker-scope <context>\` prepares one).`;
  }

  const name = nameOf(workers);

  const shared = [
    ...overlaps.contexts.map(
      (overlap) => `  context ${overlap.context}, built by ${overlap.worktrees.map(name).join(', ')}`,
    ),
    ...overlaps.files.map((overlap) => `  ${overlap.file}, changed by ${overlap.worktrees.map(name).join(', ')}`),
  ];

  return [
    `Workers: ${workers.length}`,
    ...workers.flatMap(workerLines),
    '',
    ...(shared.length === 0
      ? ['Overlaps: none']
      : ['Overlaps (a file changed by two workers can conflict when the second one merges)', ...shared]),
  ].join('\n');
}

/** A worker is named by its branch, by its worktree on a detached HEAD. */
function nameOf(workers: readonly WorkerStatus[]): (worktree: string) => string {
  return (worktree) => workers.find((worker) => worker.worktree === worktree)?.branch ?? worktree;
}

function workerLines(worker: WorkerStatus): string[] {
  const since =
    worker.ahead === undefined || worker.base === undefined
      ? 'uncommitted only: no base that names a commit'
      : `since ${worker.base}`;

  return [
    `  ${worker.branch ?? '(detached)'}  ${worker.worktree}`,
    `    ${factsOf(worker).join(', ')}`,
    `    report: ${worker.report === null ? 'none written yet' : `written ${worker.report.modified}`}`,
    `    ${worker.files.length} file${worker.files.length === 1 ? '' : 's'} changed (${since})`,
    ...worker.files.map((file) => `      ${file}`),
  ];
}

/** What its scope file says, how far it went, and a worktree without its dependencies: what the file does not say is left out. */
function factsOf(worker: WorkerStatus): string[] {
  return [
    `context ${worker.context}`,
    ...(worker.rows === undefined ? [] : [`rows ${worker.rows.map((id) => `#${id}`).join(', ') || 'none'}`]),
    ...(worker.base === undefined ? [] : [`base ${worker.base}`]),
    ...(worker.ahead === undefined ? [] : [`${worker.ahead} commit${worker.ahead === 1 ? '' : 's'} ahead`]),
    ...(worker.installed ? [] : ['dependencies not installed']),
  ];
}
