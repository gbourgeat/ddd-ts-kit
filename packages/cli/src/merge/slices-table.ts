/** The columns of a slices table, in their order. */
const SLICE_COLUMNS = ['#', 'context', 'kind', 'slice', 'start with', 'depends on', 'owner', 'status'] as const;

/** One row of a slices table: its cells, and the line it is written on. */
export interface TableRow {
  readonly id: string;
  readonly cells: readonly string[];
  readonly text: string;
}

/** A slices file read for a merge: its rows by id, and its lines with each row replaced by its id. */
export interface SlicesTable {
  readonly rows: ReadonlyMap<string, TableRow>;
  /** The lines of the file; a row is `{ row: id }`. */
  readonly lines: readonly (string | { readonly row: string })[];
}

/** The rows of every slices table of a text, and what surrounds them. */
export function slicesTable(text: string): SlicesTable {
  const rows = new Map<string, TableRow>();
  let inTable = false;

  const lines = text.split('\n').map((line): string | { row: string } => {
    const cells = cellsOf(line);
    const header = cells.map((cell) => cell.toLowerCase()).join('|') === SLICE_COLUMNS.join('|');

    if (header || (inTable && /^\s*\|[\s:|-]+\|\s*$/.test(line))) {
      inTable = true;

      return line;
    }

    inTable = inTable && cells.length === SLICE_COLUMNS.length;

    const id = cells[0] ?? '';

    if (!inTable || id === '' || rows.has(id)) {
      return line;
    }

    rows.set(id, { id, cells, text: line });

    return { row: id };
  });

  return { rows, lines };
}

/** The cells of a table row; a `\|` inside a cell is a bar of its text. */
function cellsOf(line: string): string[] {
  const row = line.trim();

  if (!row.startsWith('|') || !row.endsWith('|') || row.length < 2) {
    return [];
  }

  return row
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}
