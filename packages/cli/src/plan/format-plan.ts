import type { Batch, NotReplayed, OtherStoryRow, PlannedRow, WaitedRow, Wave, WavePlan } from './wave-plan';

/** Before the squash merge of each branch, its migrations get their real names and the trunk comes in from what already landed. */
const BEFORE_EACH_MERGE =
  'Before each merge: `npx ddd-ts-kit merge-trunk --to-land --cwd <worktree>`, then the squash merge';

/** The problems of a word: the rows can be ordered, but a worker following one as written is refused. */
const WORD_PROBLEMS: readonly string[] = ['undefined-word', 'technical-word'];

/**
 * `plan-waves` for a reader: the problems alone when there are some, else each wave and its
 * batches, the rows another story waits for, then the merge order and what to run before each
 * merge; in both cases, the planned commands the generator refused for another reason than a word.
 */
export function formatPlan(plan: WavePlan): string {
  const scope = plan.context === null ? plan.file : `${plan.file}, context ${plan.context}`;

  if (plan.problems.length > 0) {
    const words = plan.problems.every((problem) => WORD_PROBLEMS.includes(problem.kind));

    return [
      words
        ? `Waves (${scope}): none, the generator refuses names of these rows: add their terms first`
        : `Waves (${scope}): none, the plan cannot be ordered until these rows are fixed`,
      ...plan.problems.map((problem) => `  ${problem.message}`),
      ...notReplayedLines(plan.notReplayed),
    ].join('\n');
  }

  const batches = plan.waves.flatMap((wave) => wave.batches);

  if (batches.length === 0) {
    return `Waves (${scope}): none, every row is done`;
  }

  const rows = batches.reduce((count, batch) => count + batch.rows.length, 0);

  return [
    `Waves (${scope}): ${rows} rows not done, ${plural(plan.waves.length, 'wave', 'waves')}, ${plural(batches.length, 'batch', 'batches')}`,
    ...plan.waves.flatMap((wave) => waveLines(wave, plan.context)),
    ...otherStoriesLines(plan),
    `Merge order: ${plan.mergeOrder.join(', ')}`,
    BEFORE_EACH_MERGE,
    ...notReplayedLines(plan.notReplayed),
  ].join('\n');
}

/** The commands the replay could not run to their end: the names they introduce after the refusal were not judged. */
function notReplayedLines(commands: readonly NotReplayed[]): string[] {
  if (commands.length === 0) {
    return [];
  }

  return [
    'Refused for another reason than a word when the plan was replayed (the names after the refusal not judged):',
    ...commands.map((command) => `  #${command.row} \`${command.command}\`: ${command.refusal}`),
  ];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function waveLines(wave: Wave, context: string | null): string[] {
  return [`Wave ${wave.wave}`, ...wave.batches.flatMap((batch) => batchLines(batch, context))];
}

function batchLines(batch: Batch, context: string | null): string[] {
  const owner = batch.owner === batch.context ? batch.context : `${batch.owner}, ${batch.context}`;
  const aggregates = batch.aggregates.length === 0 ? 'aggregate unknown' : `aggregate ${batch.aggregates.join(', ')}`;

  return [
    `  ${batch.id} ${owner} (${aggregates})`,
    ...batch.rows.map((row) => rowLine(row, context)),
    `    ${howLine(batch)}`,
    ...(batch.sameFiles.length === 0 ? [] : [`    likely to touch the same files as ${batch.sameFiles.join(', ')}`]),
    ...(batch.unknownOverlap.length === 0
      ? []
      : [`    unknown whether it touches the files of ${batch.unknownOverlap.join(', ')}: no aggregate named`]),
  ];
}

function rowLine(row: PlannedRow, context: string | null): string {
  const status = row.status === 'todo' ? '' : ` (${row.status})`;
  const after = row.waitingForRows.map((waited) => waitedText(waited, row, context));
  const waits = after.length === 0 ? '' : `, after ${after.join(', ')}`;

  return `    #${row.id} ${row.kind} "${row.slice}"${status}${waits}`;
}

/** `#US1.02 (todo)`; with its context and story when it is of another story or outside the context shown: `#US1.04 (todo, billing, story US1)`. */
function waitedText(waited: WaitedRow, row: PlannedRow, context: string | null): string {
  const elsewhere = waited.story !== row.story || (context !== null && waited.context !== context);

  if (!elsewhere) {
    return `#${waited.id} (${waited.status})`;
  }

  const story = waited.story === null ? (row.story === null ? '' : ', no story') : `, story ${waited.story}`;

  return `#${waited.id} (${waited.status}, ${waited.context}${story})`;
}

/** The rows a story waits for in another, each with its status, and where it is planned. */
function otherStoriesLines(plan: WavePlan): string[] {
  if (plan.otherStories.length === 0) {
    return [];
  }

  return ['Rows another story waits for, not done', ...plan.otherStories.map(otherStoryLine)];
}

/** `#US1.04 billing slice "Pay invoice" (story US1, owner billing, todo): in W2.1, waited for by #US2.05`. */
function otherStoryLine(row: OtherStoryRow): string {
  const story = row.story === null ? '' : `story ${row.story}, `;
  const where = row.batch === null ? `not shown here (npx ddd-ts-kit plan-waves ${row.context})` : `in ${row.batch}`;
  const waiting = row.waitedForBy.map((id) => `#${id}`).join(', ');

  return `  #${row.id} ${row.context} ${row.kind} "${row.slice}" (${story}owner ${row.owner}, ${row.status}): ${where}, waited for by ${waiting}`;
}

function howLine(batch: Batch): string {
  if (batch.brief !== null) {
    return batch.brief;
  }

  return batch.owner === 'conductor'
    ? 'on the trunk, by the conductor'
    : `brief ${batch.owner} by hand: worker-scope briefs the worker of a context`;
}
