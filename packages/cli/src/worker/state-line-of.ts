import type { WorkerProgress } from './worker-progress';
import type { WorkerStatus } from './workers-status';

/**
 * The state of a worker in one line, and the command that resumes it:
 * `stopped mid-row #14 (6 files uncommitted, 3 TODO(domain), last verify-slice failed: tests);
 * resume: npx ddd-ts-kit worker-scope billing --resume`. `named` adds `--worktree` when another
 * worker builds the same context.
 */
export function stateLineOf(worker: WorkerStatus, named: boolean): string | undefined {
  const { progress } = worker;

  if (progress === undefined) {
    return undefined;
  }

  const details = detailsOf(progress);
  const where = named ? ` --worktree ${worker.worktree}` : '';

  return `${phaseText(progress)}${details.length === 0 ? '' : ` (${details.join(', ')})`}; ${nextText(progress, `npx ddd-ts-kit worker-scope ${worker.context} --resume${where}`)}`;
}

function phaseText({ phase, rows, next }: WorkerProgress): string {
  const current = rows.find((row) => row.state !== 'committed');
  const committed = rows.filter((row) => row.state === 'committed').map((row) => `#${row.id}`);

  if (phase === 'mid-row') {
    return `${next.action === 'wait' ? 'working' : 'stopped'} mid-row #${current?.id ?? '?'}`;
  }

  if (phase === 'between rows') {
    return `between rows (${committed.join(', ')} committed, #${current?.id ?? '?'} to do)`;
  }

  return phase === 'rows committed' ? `rows committed (${committed.join(', ')})` : 'not started';
}

function detailsOf({ inSlice, markers, verification }: WorkerProgress): string[] {
  const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

  return [
    ...(inSlice.length > 0 ? [`${count(inSlice.length, 'file')} uncommitted`] : []),
    ...(markers.domain > 0 ? [`${markers.domain} TODO(domain)`] : []),
    ...(markers.test > 0 ? [`${markers.test} it.todo`] : []),
    ...(verification === null ? [] : [verificationText(verification)]),
  ];
}

function verificationText(verification: NonNullable<WorkerProgress['verification']>): string {
  const result = verification.ok ? 'passed' : `failed: ${verification.failed.join(', ') || 'unknown'}`;

  const since = [
    ...(verification.changedAfter > 0
      ? [`${verification.changedAfter} file${verification.changedAfter === 1 ? '' : 's'} changed since`]
      : []),
    ...(verification.committedAfter ? ['committed since'] : []),
  ];

  return `last verify-slice ${result}${since.length === 0 ? '' : `, ${since.join(', ')}`}`;
}

function nextText({ next, agent }: WorkerProgress, resume: string): string {
  if (next.action === 'merge') {
    return 'next: merge the branch';
  }

  if (next.action === 'wait') {
    return `an agent is working (last tool call ${agent?.lastSeen ?? 'unknown'})`;
  }

  return `resume: ${resume}`;
}
