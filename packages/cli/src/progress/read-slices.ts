import type { Workspace } from '../workspace/index.js';
import type { Slice } from './slice.js';

export const SLICES_FILE = 'docs/architecture/slices.md';

const COLUMNS = ['#', 'context', 'kind', 'slice', 'start with', 'depends on', 'owner', 'status'];

/** The rows of the slices table; undefined when the project has no slices file or the file has no such table. */
export function readSlices(ws: Workspace): Slice[] | undefined {
  const lines = (ws.read(SLICES_FILE) ?? '').split('\n');

  const header = lines.findIndex(
    (line) =>
      cellsOf(line)
        .map((cell) => cell.toLowerCase())
        .join('|') === COLUMNS.join('|'),
  );

  if (header === -1) {
    return undefined;
  }

  const end = lines.findIndex((line, index) => index > header + 1 && !line.trim().startsWith('|'));

  return lines
    .slice(header + 2, end === -1 ? undefined : end)
    .map(cellsOf)
    .filter((cells) => cells.length === COLUMNS.length)
    .map(sliceOf);
}

/** The cells of a table row; a `\|` inside a cell is a bar of its text. */
function cellsOf(line: string): string[] {
  const row = line.trim();

  if (!row.startsWith('|') || !row.endsWith('|')) {
    return [];
  }

  return row
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}

function sliceOf(cells: readonly string[]): Slice {
  const [id = '', context = '', kind = '', slice = '', startWith = '', dependsOn = '', owner = '', status = ''] = cells;

  return {
    id,
    context,
    kind,
    slice,
    startWith,
    dependsOn: dependsOn
      .split(',')
      .map((row) => row.trim())
      .filter((row) => row !== ''),
    owner,
    status: status.toLowerCase(),
  };
}
