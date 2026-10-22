import { SchemaNode } from '../../schema/schema-node';
import { isAsyncIterable } from '../../support/is-async-iterable';
import { isRecord } from '../../support/is-record';
import type { BodyShape } from '../body-shape';
import type { RepresentedBody } from '../represented-body';
import type { Representation } from '../representation';
import { csvCell } from './csv-cell';

const LINE_END = '\r\n';

/**
 * `text/csv` for a list of flat rows: a page (its `items`), a list, or a list streamed as it is
 * read. One header line with the names of the properties of a row, in the order of the schema,
 * then one line per row, written one at a time. A body whose rows hold a list or an object is
 * refused when the routes are mounted: CSV has no way to say it. Never read.
 */
export class CsvRepresentation implements Representation {
  readonly mediaType = 'text/csv';

  readonly problemMediaType = undefined;

  write(body: unknown, shape: BodyShape): RepresentedBody {
    return lines(rowsOf(body), columnsOf(rowNode(shape)));
  }

  refuses(shape: BodyShape): string | undefined {
    const row = rowNode(shape);

    if (row === undefined) {
      return 'the body is no list and no page of items';
    }

    const nested = row.properties().find(([, node]) => !node.isScalar());

    return nested === undefined ? undefined : `the column "${nested[0]}" holds a list or an object`;
  }
}

/** The schema of one row: the items of a list, or of the `items` of a page. */
function rowNode(shape: BodyShape): SchemaNode | undefined {
  const node = SchemaNode.of(shape.schema);

  if (node.type() === 'array') {
    return node.items();
  }

  const items = node.properties().find(([name]) => name === 'items')?.[1];

  return items?.type() === 'array' ? items.items() : undefined;
}

function columnsOf(row: SchemaNode | undefined): readonly string[] {
  return (row?.properties() ?? []).map(([name]) => name);
}

async function* rowsOf(body: unknown): AsyncIterable<unknown> {
  if (isAsyncIterable(body)) {
    yield* body;

    return;
  }

  const rows: unknown = isRecord(body) ? body['items'] : body;

  yield* Array.isArray(rows) ? rows : [];
}

async function* lines(rows: AsyncIterable<unknown>, columns: readonly string[]): AsyncIterable<string> {
  yield `${columns.map((column) => csvCell(column)).join(',')}${LINE_END}`;

  for await (const row of rows) {
    const record = isRecord(row) ? row : {};

    yield `${columns.map((column) => csvCell(record[column])).join(',')}${LINE_END}`;
  }
}
