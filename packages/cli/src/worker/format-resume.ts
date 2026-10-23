import { namedPaths } from './named-paths';
import type { WorkerResume } from './resume-worker';
import type { WorkerProgress } from './worker-progress';

/** `worker-scope --resume` for the conductor: where the worker stands, then the message or the briefing to send as it is. */
export function formatResume(resume: WorkerResume): string {
  const { progress } = resume;

  return [
    `worker ${resume.branch ?? '(detached)'}  ${resume.worktree}  (base ${resume.base ?? 'unknown'})`,
    `rows: ${progress.rows.map((row) => `#${row.id} ${row.state}${row.commit === undefined ? '' : ` ${row.commit}${row.byOrder ? ' (by order)' : ''}`}`).join(', ') || 'none in the scope file'}`,
    ...rowLines(progress),
    `report: ${progress.report === null ? 'none written' : `written ${minute(progress.report.modified)} (${progress.report.current ? 'current' : 'older than its last change'})`}`,
    `agent: ${agentText(progress)}`,
    ...resume.notes.map((note) => `note: ${note}`),
    '',
    ...nextLines(resume),
  ].join('\n');
}

function rowLines({ rows, inSlice, markers, verification }: WorkerProgress): string[] {
  const current = rows.find((row) => row.state === 'in progress');

  if (current === undefined) {
    return [];
  }

  const ran =
    verification === null
      ? 'verify-slice not run'
      : `last verify-slice ${minute(verification.at)} ${verification.ok ? 'passed' : `failed: ${verification.failed.join(', ')}`}${verification.changedAfter > 0 ? ` (${files(verification.changedAfter)} changed since)` : ''}`;

  return [
    `#${current.id}: ${files(inSlice.length)} uncommitted (${namedPaths(inSlice)}), ${markers.domain} TODO(domain), ${markers.test} it.todo; ${ran}`,
  ];
}

function agentText({ agent, report }: WorkerProgress): string {
  if (agent === null) {
    return 'none recorded by the guard';
  }

  const ended = agent.lastStop === null ? 'stopped without ending (a limit or an error)' : 'ended on its own';
  const reported = report?.current === true ? 'with a current report' : 'without a current report';

  return `${agent.agentId}, run ${agent.run}, ${agent.toolCalls} tool calls counted, last tool call ${minute(agent.lastSeen)}, ${ended} ${reported}`;
}

function nextLines(resume: WorkerResume): string[] {
  const { next, sendMessage, briefing } = resume;
  const block = (text: string): string[] => ['---', text, '---'];

  if (next.action === 'merge' || briefing === null) {
    return ['next: every row is committed: merge the branch (parallel-work, step 6).'];
  }

  const launch = block(briefing);

  if (sendMessage === null) {
    return ['next: launch a new context-builder with this briefing:', ...launch];
  }

  return [
    `next: SendMessage to ${sendMessage.to}:`,
    ...block(sendMessage.message),
    'If SendMessage is refused, or the agent stops again without progress: launch a new context-builder with this briefing:',
    ...launch,
  ];
}

function files(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`;
}

/** An ISO date to the minute, as the guard and the kit write them. */
function minute(iso: string): string {
  return iso.replace(/:\d\d(\.\d+)?Z$/, 'Z');
}
