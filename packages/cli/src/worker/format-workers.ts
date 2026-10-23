import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file';
import { stateLineOf } from './state-line-of';
import type { WorkerStatus, WorkersStatus } from './workers-status';

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
    ...workers.flatMap((worker) => workerLines(worker, workers)),
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

function workerLines(worker: WorkerStatus, workers: readonly WorkerStatus[]): string[] {
  const since =
    worker.ahead === undefined || worker.base === undefined
      ? 'uncommitted only: no base that names a commit'
      : `since ${worker.landed === undefined ? worker.base : `it landed on ${worker.base}`}`;

  const state = stateLineOf(worker, workers.filter((other) => other.context === worker.context).length > 1);

  return [
    `  ${worker.branch ?? '(detached)'}  ${worker.worktree}`,
    `    ${factsOf(worker).join(', ')}`,
    ...(state === undefined ? [] : [`    state: ${state}`]),
    ...mergeLines(worker),
    `    report: ${reportText(worker)}`,
    `    ${worker.files.length} file${worker.files.length === 1 ? '' : 's'} changed (${since})`,
    ...worker.files.map((file) => `      ${file}`),
  ];
}

function reportText({ report, progress }: WorkerStatus): string {
  if (report === null) {
    return 'none written yet';
  }

  const current = progress?.report?.current;

  return `written ${report.modified}${current === undefined ? '' : current ? ' (current)' : ' (older than its last change)'}`;
}

/** What its scope file says, how far it went, and a worktree without its dependencies: what the file does not say is left out. */
function factsOf(worker: WorkerStatus): string[] {
  return [
    `context ${worker.context}`,
    ...(worker.rows === undefined ? [] : [`rows ${worker.rows.map((id) => `#${id}`).join(', ') || 'none'}`]),
    ...(worker.base === undefined ? [] : [`base ${worker.base}`]),
    ...(worker.ahead === undefined ? [] : [`${worker.ahead} commit${worker.ahead === 1 ? '' : 's'} ahead`]),
    ...(worker.behind === undefined || worker.behind === 0 ? [] : [`${worker.behind} behind`]),
    ...(worker.installed ? [] : ['dependencies not installed']),
  ];
}

/** Where it landed, and what bringing the base in would leave conflicted. */
function mergeLines({ landed, mergePreview }: WorkerStatus): string[] {
  const preview =
    mergePreview === undefined
      ? []
      : [
          mergePreview.conflicts === 0
            ? '    merge-trunk would merge the base without a conflict'
            : `    merge-trunk would leave ${mergePreview.conflicts} conflicted file${mergePreview.conflicts === 1 ? '' : 's'}: ${mergePreview.files.join(', ')}`,
        ];

  const rows =
    landed === undefined || landed.rows.length === 0 ? '' : ` (rows ${landed.rows.map((id) => `#${id}`).join(', ')})`;

  return [
    ...(landed === undefined ? [] : [`    landed as ${landed.commit.slice(0, 7)} "${landed.subject}"${rows}`]),
    ...preview,
  ];
}
