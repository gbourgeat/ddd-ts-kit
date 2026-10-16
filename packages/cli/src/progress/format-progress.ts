import type { Progress, RemainingCount, SlicesProgress } from './progress.js';
import type { Slice } from './slice.js';

const STATUS_ORDER = ['in progress', 'todo', 'done'];

/** Said when the project keeps no plan: where the recommended path starts. */
const NO_PLAN =
  'no docs/architecture/plan.md with a `Next:` line. The recommended path starts with step 1, discover the domain, before any code: `/ddd-ts-kit:start` conducts the steps and writes the plan (docs/guides/methodology.md of ddd-ts-kit)';

/** `status` for a reader: the next step, the slices that are not done by status, the count by owner, what is left to fill. */
export function formatProgress(progress: Progress): string {
  return [
    `Next: ${progress.next ?? NO_PLAN}`,
    '',
    ...(progress.slices === null
      ? ['Slices: no docs/architecture/slices.md with a slices table (the skill ddd-ts-kit:plan-slices writes it)']
      : sliceLines(progress.slices)),
    '',
    'Remaining',
    ...progress.remaining.map(remainingLine),
  ].join('\n');
}

function sliceLines(slices: SlicesProgress): string[] {
  const statuses = [
    ...STATUS_ORDER.filter((status) => slices.byStatus[status] !== undefined),
    ...Object.keys(slices.byStatus).filter((status) => !STATUS_ORDER.includes(status)),
  ];

  const open = statuses
    .filter((status) => status !== 'done')
    .flatMap((status) => [`  ${status}`, ...slices.rows.filter((row) => row.status === status).map(rowLine)]);

  const owners = Object.entries(slices.byOwner).map(
    ([owner, byStatus]) => `    ${owner}: ${counts(byStatus, statuses)}`,
  );

  const duplicated =
    slices.duplicates.length === 0
      ? []
      : [`  row numbers used more than once: ${slices.duplicates.join(', ')} (give each row its own number)`];

  const unscoped =
    slices.unscoped.length === 0
      ? []
      : [
          `  row numbers without the code of their story or milestone: ${slices.unscoped.join(', ')} (number them \`US5.03\`, \`M2.07\`: a sequence across stories slides when one is cut)`,
        ];

  return [
    `Slices (${slices.file}): ${slices.rows.length}, ${counts(slices.byStatus, statuses)}`,
    ...duplicated,
    ...unscoped,
    ...open,
    '  by owner',
    ...owners,
  ];
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
