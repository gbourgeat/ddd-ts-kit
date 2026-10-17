import type { Batch, PlannedRow, Wave, WavePlan } from './wave-plan.js';

/** `plan-waves` for a reader: the problems alone when there are some, else each wave and its batches, then the merge order. */
export function formatPlan(plan: WavePlan): string {
  const scope = plan.context === null ? plan.file : `${plan.file}, context ${plan.context}`;

  if (plan.problems.length > 0) {
    return [
      `Waves (${scope}): none, the plan cannot be ordered until these rows are fixed`,
      ...plan.problems.map((problem) => `  ${problem.message}`),
    ].join('\n');
  }

  const batches = plan.waves.flatMap((wave) => wave.batches);

  if (batches.length === 0) {
    return `Waves (${scope}): none, every row is done`;
  }

  const rows = batches.reduce((count, batch) => count + batch.rows.length, 0);

  return [
    `Waves (${scope}): ${rows} rows not done, ${plural(plan.waves.length, 'wave', 'waves')}, ${plural(batches.length, 'batch', 'batches')}`,
    ...plan.waves.flatMap(waveLines),
    `Merge order: ${plan.mergeOrder.join(', ')}`,
  ].join('\n');
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function waveLines(wave: Wave): string[] {
  return [`Wave ${wave.wave}`, ...wave.batches.flatMap(batchLines)];
}

function batchLines(batch: Batch): string[] {
  const owner = batch.owner === batch.context ? batch.context : `${batch.owner}, ${batch.context}`;
  const aggregates = batch.aggregates.length === 0 ? 'aggregate unknown' : `aggregate ${batch.aggregates.join(', ')}`;

  return [
    `  ${batch.id} ${owner} (${aggregates})`,
    ...batch.rows.map(rowLine),
    `    ${howLine(batch)}`,
    ...(batch.sameFiles.length === 0 ? [] : [`    likely to touch the same files as ${batch.sameFiles.join(', ')}`]),
    ...(batch.unknownOverlap.length === 0
      ? []
      : [`    unknown whether it touches the files of ${batch.unknownOverlap.join(', ')}: no aggregate named`]),
  ];
}

function rowLine(row: PlannedRow): string {
  const status = row.status === 'todo' ? '' : ` (${row.status})`;
  const waits = row.waitingFor.length === 0 ? '' : `, after ${row.waitingFor.map((id) => `#${id}`).join(', ')}`;

  return `    #${row.id} ${row.kind} "${row.slice}"${status}${waits}`;
}

function howLine(batch: Batch): string {
  if (batch.brief !== null) {
    return batch.brief;
  }

  return batch.owner === 'conductor'
    ? 'on the trunk, by the conductor'
    : `brief ${batch.owner} by hand: worker-scope briefs the worker of a context`;
}
