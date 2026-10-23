import { namedPaths } from './named-paths';
import { REPORT_FILE } from './report-file';
import type { WorkerProgress } from './worker-progress';

/** Where the resumed worker works and what it checks against. */
export interface ResumedPlace {
  readonly context: string;
  /** Absolute path of the project inside the worktree. */
  readonly project: string;
  readonly base: string;
}

/**
 * The message that resumes a stopped agent where it stopped, written from what its worktree
 * holds: the row to finish and the one not to start, what is committed, the files it left, the
 * markers and the last verification, then the steps to the end of the row.
 */
export function resumeMessage(progress: WorkerProgress, place: ResumedPlace): string {
  const { rows } = progress;
  const index = rows.findIndex((row) => row.state !== 'committed');
  const current = rows[index];
  const after = rows[index + 1];
  const committed = rows.filter((row) => row.state === 'committed').map((row) => `#${row.id}`);
  const verify = `\`npx ddd-ts-kit verify-slice ${place.context} --since ${place.base}\``;

  const row =
    current === undefined
      ? 'the row under way'
      : `row #${current.id}${current.slice === '' ? '' : ` (${current.slice})`}`;

  return [
    `Continue ${row} in ${place.project}${after === undefined ? '' : `; do not start #${after.id}`}.`,
    [
      ...(committed.length > 0 ? [`Committed: ${committed.join(', ')}.`] : []),
      ...(progress.inSlice.length > 0 ? [`Left modified by you: ${namedPaths(progress.inSlice)}.`] : []),
      leftText(progress),
    ].join(' '),
    `Next: finish ${current === undefined ? 'it' : `#${current.id}`}, ${verify} until it passes, commit with the command it prints, rewrite ${REPORT_FILE}, end with the report.`,
  ].join('\n');
}

function leftText({ markers, verification }: WorkerProgress): string {
  const left = [
    ...(markers.domain > 0 ? [`${markers.domain} TODO(domain)`] : []),
    ...(markers.test > 0 ? [`${markers.test} it.todo`] : []),
  ];

  const remain = left.length === 0 ? 'No marker remains' : `${left.join(' and ')} remain`;

  if (verification === null) {
    return `${remain}; you have not run verify-slice yet.`;
  }

  if (verification.ok) {
    const unchanged = verification.changedAfter === 0 && !verification.committedAfter;

    return `${remain}; your last verify-slice passed${unchanged ? ' and nothing changed since: commit with the command it printed' : ', files changed since'}.`;
  }

  return `${remain}; your last verify-slice failed at ${verification.failed.join(', ') || 'a step'}.`;
}
