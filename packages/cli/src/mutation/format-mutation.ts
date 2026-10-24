import type { ContextScore } from './mutation-scores';

const COLUMNS = ['Context', 'Detected', 'Undetected', 'Errors', 'Score', 'Floor', ''] as const;

/** One line per context, its score against its floor, then the verdict. */
export function formatMutation(scores: readonly ContextScore[]): string {
  if (scores.length === 0) {
    return 'The report holds no mutant of a context: nothing of the domain layers was mutated.';
  }

  const rows = scores.map((entry) => [
    entry.context,
    String(entry.detected),
    String(entry.undetected),
    String(entry.errors),
    `${entry.score.toFixed(1)}%`,
    `${entry.floor}%`,
    entry.held ? 'held' : 'under the floor',
  ]);

  const widths = COLUMNS.map((column, index) => Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)));

  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join('  ')
      .trimEnd();

  const under = scores.filter((entry) => !entry.held);

  const verdict =
    under.length === 0
      ? 'Every context holds its mutation floor.'
      : `${under.length} context(s) under the floor: ${under.map((entry) => entry.context).join(', ')}. A survivor is a rule no test states: read it as a decision, then write the test, or leave the mutant alive and say why.`;

  return [line(COLUMNS), ...rows.map(line), '', verdict].join('\n');
}
