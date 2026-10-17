import type { Workspace } from '../workspace/index.js';
import { cellsOf } from './cells-of.js';
import type { Slice } from './slice.js';

export const SLICES_FILE = 'docs/architecture/slices.md';

const COLUMNS = ['#', 'context', 'kind', 'slice', 'start with', 'depends on', 'owner', 'status'];

/**
 * The rows of every slices table, in the order of the file: a plan may keep one table per
 * milestone or story, each under the same header. Undefined when the project has no slices file
 * or the file has no such table.
 */
export function readSlices(ws: Workspace): Slice[] | undefined {
  const lines = (ws.read(SLICES_FILE) ?? '').split('\n');
  const headers = lines.flatMap((line, index) => (isHeader(line) ? [index] : []));

  if (headers.length === 0) {
    return undefined;
  }

  return headers.flatMap((header) => tableRows(lines, header)).map(sliceOf);
}

function isHeader(line: string): boolean {
  return (
    cellsOf(line)
      .map((cell) => cell.toLowerCase())
      .join('|') === COLUMNS.join('|')
  );
}

/** The rows under a header and its separator, up to the first line that is not a row. */
function tableRows(lines: readonly string[], header: number): string[][] {
  const end = lines.findIndex((line, index) => index > header + 1 && !line.trim().startsWith('|'));

  return lines
    .slice(header + 2, end === -1 ? undefined : end)
    .map(cellsOf)
    .filter((cells) => cells.length === COLUMNS.length);
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
