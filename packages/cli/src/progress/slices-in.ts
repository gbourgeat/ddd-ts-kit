import { cellsOf } from './cells-of';
import type { Slice } from './slice';

const COLUMNS = ['#', 'context', 'kind', 'slice', 'start with', 'depends on', 'owner', 'status'];

/**
 * The rows of every slices table of a text, in its order: a plan may keep one table per milestone
 * or story, each under the same header. Undefined when the text has no such table. Reads the
 * slices file of the project as well as one version of it out of git.
 */
export function slicesIn(text: string): Slice[] | undefined {
  const lines = text.split('\n');
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
