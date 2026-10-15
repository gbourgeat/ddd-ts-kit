import { CliError } from '../cli-error.js';
import { readSliceRules } from '../progress/read-slice-rules.js';
import { readSlices, SLICES_FILE } from '../progress/read-slices.js';
import type { Slice } from '../progress/slice.js';
import type { Workspace } from '../workspace/index.js';
import type { BriefedSlice } from './briefed-slice.js';

/** The rows a worker is briefed on, with their rules, and what the conductor should know about them. */
export interface BriefedRows {
  readonly slices: readonly BriefedSlice[];
  readonly notes: readonly string[];
}

/** Past this many rows, an agent runs out of turns or context before its report. */
const ROWS_PER_AGENT = 2;

/**
 * The rows of the slices file for one worker: the ids asked for, in the order given, or by
 * default every row of the context still to do. A row asked for must exist once and belong to
 * the context. Ids are compared as text.
 */
export function briefedRows(ws: Workspace, context: string, ids: readonly string[] | undefined): BriefedRows {
  const rows = readSlices(ws) ?? [];
  const rules = readSliceRules(ws);
  const chosen = ids === undefined ? todoRows(rows, context) : asked(rows, context, ids);
  const slices = chosen.map((row) => ({ ...row, rules: rules.get(row.id) }));

  return { slices, notes: [...doneNotes(slices, ids), ...sizeNotes(slices, context)] };
}

function todoRows(rows: readonly Slice[], context: string): Slice[] {
  return rows.filter((row) => row.owner === context && row.status === 'todo');
}

function asked(rows: readonly Slice[], context: string, ids: readonly string[]): Slice[] {
  return ids.map((id) => {
    const matching = rows.filter((row) => row.id === id);
    const [row] = matching;

    if (row === undefined) {
      throw new CliError(
        `Row #${id} is not in ${SLICES_FILE}.`,
        `Pass the ids of the # column as written (\`--rows 4.15,4.16\`); \`npx ddd-ts-kit status\` lists them.`,
      );
    }

    if (matching.length > 1) {
      throw new CliError(
        `Row #${id} appears ${matching.length} times in ${SLICES_FILE}.`,
        'Number every row once across the file (`npx ddd-ts-kit status` names the numbers used twice), then brief again.',
      );
    }

    if (row.owner !== context) {
      throw new CliError(
        `Row #${id} is owned by ${row.owner || 'nobody'}, not by ${context}.`,
        `Brief that row to the worker of its owner, or change its Owner column to ${context} first.`,
      );
    }

    return row;
  });
}

function doneNotes(slices: readonly BriefedSlice[], ids: readonly string[] | undefined): string[] {
  if (ids === undefined) {
    return [];
  }

  return slices
    .filter((row) => row.status === 'done')
    .map((row) => `Row #${row.id} is marked done in ${SLICES_FILE}: brief it again only to rework it.`);
}

function sizeNotes(slices: readonly BriefedSlice[], context: string): string[] {
  if (slices.length <= ROWS_PER_AGENT) {
    return [];
  }

  return [
    `${slices.length} rows in one briefing: an agent holds ${ROWS_PER_AGENT} at most before its turns or its context run out. Brief one agent per row, in sequence, with \`npx ddd-ts-kit worker-scope ${context} --rows <id>\`.`,
  ];
}
