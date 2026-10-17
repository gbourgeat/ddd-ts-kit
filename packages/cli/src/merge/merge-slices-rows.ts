import { type SlicesTable, slicesTable, type TableRow } from './slices-table.js';

/** The merged slices file, or the cells both sides changed differently, as `#<id> <column>`. */
export type SlicesMerge = { readonly text: string } | { readonly conflicts: readonly string[] };

const COLUMNS = ['#', 'context', 'kind', 'slice', 'start with', 'depends on', 'owner', 'status'];
const STATUS = COLUMNS.indexOf('status');
const RANKS: Readonly<Record<string, number>> = { todo: 1, 'in progress': 2, 'in-progress': 2, doing: 2, done: 3 };

type Tables = Readonly<Record<'base' | 'ours' | 'theirs', SlicesTable>>;

/**
 * Merges the slices file row by row, by id: the status of a row is the furthest of both sides
 * (done, then in progress, then todo), each other cell is merged on its own (the side that changed
 * it wins), a row one side deleted and the other left alone is deleted, a row one side added is
 * placed after the row it follows there. The text around the tables merges when one side alone
 * changed it. A cell both sides changed differently is left to a person.
 */
export function mergeSlicesRows(base: string, ours: string, theirs: string): SlicesMerge {
  const tables: Tables = { base: slicesTable(base), ours: slicesTable(ours), theirs: slicesTable(theirs) };
  const skeleton = skeletonOf(tables);
  const merged = mergedRows(tables);
  const conflicts = [...(skeleton === undefined ? ['the text around the tables'] : []), ...merged.conflicts];

  if (skeleton === undefined || conflicts.length > 0) {
    return { conflicts };
  }

  const other = skeleton === tables.ours ? tables.theirs : tables.ours;
  const lines = placed(skeleton, other, merged.rows);

  return { text: lines.join('\n') };
}

/** The side whose text around the tables the result keeps: the one that changed it, if only one did. */
function skeletonOf(tables: Tables): SlicesTable | undefined {
  const around = (table: SlicesTable): string =>
    table.lines.filter((line): line is string => typeof line === 'string').join('\n');

  if (around(tables.theirs) === around(tables.base) || around(tables.theirs) === around(tables.ours)) {
    return tables.ours;
  }

  return around(tables.ours) === around(tables.base) ? tables.theirs : undefined;
}

function mergedRows(tables: Tables): { rows: Map<string, string>; conflicts: string[] } {
  const rows = new Map<string, string>();
  const conflicts: string[] = [];

  for (const id of new Set([...tables.ours.rows.keys(), ...tables.theirs.rows.keys()])) {
    const [base, ours, theirs] = [tables.base, tables.ours, tables.theirs].map((table) => table.rows.get(id));
    const row = mergedRow({ base, ours, theirs }, conflicts);

    if (row !== undefined) {
      rows.set(id, row);
    }
  }

  return { rows, conflicts };
}

/** One row merged; undefined when one side deleted it and the other left it as the base had it. */
function mergedRow(
  sides: Readonly<Record<'base' | 'ours' | 'theirs', TableRow | undefined>>,
  conflicts: string[],
): string | undefined {
  const { base, ours, theirs } = sides;

  if (ours === undefined || theirs === undefined) {
    const kept = ours ?? theirs;

    return base !== undefined && kept?.text === base.text ? undefined : kept?.text;
  }

  const cells = ours.cells.map((cell, column) =>
    mergedCell(column, [base?.cells[column], cell, theirs.cells[column] ?? '']),
  );

  const unsettled = cells.flatMap((cell, column) =>
    cell === undefined ? [`#${ours.id} ${COLUMNS[column] ?? column}`] : [],
  );

  conflicts.push(...unsettled);

  return writtenRow(
    cells.map((cell) => cell ?? ''),
    ours,
    theirs,
  );
}

function mergedCell(
  column: number,
  [base, ours, theirs]: readonly [string | undefined, string, string],
): string | undefined {
  const [oursRank, theirsRank] = [RANKS[ours.toLowerCase()], RANKS[theirs.toLowerCase()]];

  if (column === STATUS && oursRank !== undefined && theirsRank !== undefined) {
    return oursRank >= theirsRank ? ours : theirs;
  }

  if (ours === theirs || theirs === base) {
    return ours;
  }

  return ours === base ? theirs : undefined;
}

/** The row as one side wrote it when it is that side's, else written again. */
function writtenRow(cells: readonly string[], ours: TableRow, theirs: TableRow): string {
  const same = (row: TableRow): boolean => row.cells.join('\0') === cells.join('\0');

  if (same(ours)) {
    return ours.text;
  }

  return same(theirs) ? theirs.text : `|${cells.map((cell) => (cell === '' ? ' ' : ` ${cell} `)).join('|')}|`;
}

/** The lines of the skeleton with its rows merged, and the rows only the other side has placed after the row they follow there. */
function placed(skeleton: SlicesTable, other: SlicesTable, rows: ReadonlyMap<string, string>): string[] {
  const after = new Map<string, string[]>();
  const tail: string[] = [];
  let anchor: string | undefined;

  for (const line of other.lines) {
    const id = typeof line === 'string' ? undefined : line.row;

    if (id !== undefined && skeleton.rows.has(id)) {
      anchor = id;
    } else if (id !== undefined && rows.has(id)) {
      if (anchor === undefined) {
        tail.push(id);
      } else {
        after.set(anchor, [...(after.get(anchor) ?? []), id]);
      }
    }
  }

  return withRows(skeleton, rows, { after, tail });
}

function withRows(
  skeleton: SlicesTable,
  rows: ReadonlyMap<string, string>,
  { after, tail }: { after: ReadonlyMap<string, readonly string[]>; tail: readonly string[] },
): string[] {
  const lines: string[] = [];
  const last = skeleton.lines.findLastIndex((line) => typeof line !== 'string');

  skeleton.lines.forEach((line, index) => {
    if (typeof line === 'string') {
      lines.push(line);
    } else {
      lines.push(...[line.row, ...(after.get(line.row) ?? [])].flatMap((id) => rows.get(id) ?? []));
    }

    if (index === last) {
      lines.push(...tail.flatMap((id) => rows.get(id) ?? []));
    }
  });

  return last === -1 ? [...lines, ...tail.flatMap((id) => rows.get(id) ?? [])] : lines;
}
