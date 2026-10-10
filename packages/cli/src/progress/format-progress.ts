import type { Progress, RemainingCount, SlicesProgress } from './progress.js';
import type { Slice } from './slice.js';

const STATUS_ORDER = ['in progress', 'todo', 'done'];

/** `status` for a reader: the next step, the slices that are not done by status, the count by owner, what is left to fill. */
export function formatProgress(progress: Progress): string {
  return [
    `Next: ${progress.next ?? 'no docs/architecture/plan.md with a `Next:` line (the skill ddd-ts-kit:start writes it)'}`,
    '',
    ...(progress.slices === null ? ['Slices: no docs/architecture/slices.md with a slices table (the skill ddd-ts-kit:plan-slices writes it)'] : sliceLines(progress.slices)),
    '',
    'Remaining',
    ...progress.remaining.map(remainingLine),
  ].join('\n');
}

function sliceLines(slices: SlicesProgress): string[] {
  const statuses = [...STATUS_ORDER.filter((status) => slices.byStatus[status] !== undefined), ...Object.keys(slices.byStatus).filter((status) => !STATUS_ORDER.includes(status))];
  const open = statuses.filter((status) => status !== 'done').flatMap((status) => [`  ${status}`, ...slices.rows.filter((row) => row.status === status).map(rowLine)]);
  const owners = Object.entries(slices.byOwner).map(([owner, byStatus]) => `    ${owner}: ${counts(byStatus, statuses)}`);

  return [`Slices (${slices.file}): ${slices.rows.length}, ${counts(slices.byStatus, statuses)}`, ...open, '  by owner', ...owners];
}

function counts(byStatus: Readonly<Record<string, readonly string[]>>, statuses: readonly string[]): string {
  return statuses
    .filter((status) => byStatus[status] !== undefined)
    .map((status) => `${byStatus[status]?.length ?? 0} ${status}`)
    .join(', ');
}

function rowLine(row: Slice): string {
  const waits = row.dependsOn.length > 0 ? `, depends on ${row.dependsOn.join(', ')}` : '';

  return `    #${row.id} ${row.context} ${row.kind} "${row.slice}" (owner ${row.owner}${waits})`;
}

function remainingLine(count: RemainingCount): string {
  return `  ${count.context === '' ? 'outside the contexts' : count.context}: ${count.domain} TODO(domain), ${count.platform} TODO(platform), ${count.test} it.todo`;
}
