import { citationLine } from './citation-line';
import type { CitationsAtRef } from './stale-names-at';

/** Past this many rows, the report counts them instead of naming them. */
const NAMED_ROWS = 5;

/** `cited` for a reader: the stale names of the design of some rows at a ref, then how many are present or planned. */
export function formatCitations(report: CitationsAtRef, rows: readonly string[]): string {
  const { base, commit, counts, citations, notes } = report;
  const design = `the design of ${rows.length > NAMED_ROWS ? `${rows.length} rows` : rows.map((id) => `#${id}`).join(', ') || 'no row'}`;
  const tally = `${counts.present} present, ${counts.planned} planned (silent)`;
  const notesLines = notes.map((note) => `note: ${note}`);

  if (citations.length === 0) {
    return [`No stale name in ${design} on ${base} (checked at ${commit}): ${tally}.`, ...notesLines].join('\n');
  }

  return [
    `Names of ${design} that ${base} does not have (checked at ${commit}):`,
    ...citations.map((citation) => `- ${citationLine(citation, base)}${rowsOf(citation.rows)}`),
    `Also cited: ${tally}.`,
    ...notesLines,
  ].join('\n');
}

function rowsOf(rows: readonly string[]): string {
  return rows.length === 0 ? '' : ` (${rows.map((id) => `#${id}`).join(', ')})`;
}
