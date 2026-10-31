import type { Progress, RemainingCount, SlicesProgress, StatusRow, UnclosedStory } from './progress';
import { SLICE_STATUS } from './slice';

const STATUS_ORDER: readonly string[] = [SLICE_STATUS.inProgress, SLICE_STATUS.todo, SLICE_STATUS.done];

/** Said when the project keeps no plan: where the recommended path starts. */
const NO_PLAN =
  'no docs/architecture/plan.md with a `Next:` line. The recommended path starts with step 1, discover the domain, before any code: `/ddd-ts-kit:start` conducts the steps and writes the plan (docs/guides/methodology.md of ddd-ts-kit)';

/** `status` for a reader: the next step, the slices that are not done by status, the count by owner, what is left to fill. */
export function formatProgress(progress: Progress): string {
  return [
    `Next: ${progress.next ?? NO_PLAN}`,
    ...(progress.planNext === null
      ? []
      : [`  (the plan says: ${progress.planNext}; at step 7 the next step is read from the slices)`]),
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
    .filter((status) => status !== SLICE_STATUS.done)
    .map((status) => ({ status, rows: slices.rows.filter((row) => row.status === status) }))
    .filter(({ rows }) => rows.length > 0)
    .flatMap(({ status, rows }) => [`  ${status}`, ...rows.map(rowLine)]);

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
    ...slices.unclosed.map(unclosedLine),
    ...landedLines(slices),
    ...open,
    ...notShownLines(slices),
    '  by owner',
    ...owners,
  ];
}

/** What `--ready` leaves out. */
function notShownLines({ notShown }: SlicesProgress): string[] {
  return notShown === undefined || notShown === 0
    ? []
    : [`  ${notShown} more not ready to start on the trunk (without --ready to list them)`];
}

function unclosedLine({ story, markers, command }: UnclosedStory): string {
  return `  story ${story}: every row done, ${markers} ${markers === 1 ? 'marker' : 'markers'} left: ${command}`;
}

function counts(byStatus: Readonly<Record<string, readonly string[]>>, statuses: readonly string[]): string {
  return statuses
    .filter((status) => byStatus[status] !== undefined)
    .map((status) => `${byStatus[status]?.length ?? 0} ${status}`)
    .join(', ');
}

function rowLine(row: StatusRow): string {
  const waits = row.dependsOn.length > 0 ? `, depends on ${row.dependsOn.join(', ')}` : '';

  return `    #${row.id} ${row.context} ${row.kind} "${row.slice}" (owner ${row.owner}${waits})${readyText(row)}`;
}

/** Whether the row can start: on the trunk, once the branches holding its dependencies merge, or later. */
function readyText(row: StatusRow): string {
  const waiting = row.waitingFor ?? [];
  const ids = waiting.map((id) => `#${id}`).join(', ');

  switch (row.ready) {
    case 'trunk':
      return ': ready on the trunk';
    case 'branch':
      return `: ready on a branch, once ${ids} ${waiting.length === 1 ? 'merges' : 'merge'}`;
    case 'waiting':
      return `: waits for ${ids}`;
    /* v8 ignore next 2 -- ADR-0001: statusRowOf gives each row that is not done a ready value */
    default:
      return '';
  }
}

function remainingLine(count: RemainingCount): string {
  return `  ${count.context === '' ? 'outside the contexts' : count.context}: ${count.domain} TODO(domain), ${count.platform} TODO(platform), ${count.test} it.todo, ${count.review} TODO(review)`;
}

/** The rows that landed with a worker's branch while the slices file does not mark them done. */
function landedLines({ landedNotDone, file }: SlicesProgress): string[] {
  return landedNotDone.map(
    ({ id, commit }) =>
      `  #${id} landed on the trunk (${commit.slice(0, 7)}) but is not marked done: mark it done in ${file}`,
  );
}
