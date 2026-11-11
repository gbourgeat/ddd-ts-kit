import { ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';

export interface TracedTable {
  readonly table: string;
  readonly schema?: string;
  /** The columns of the row, in which a trace holds NULL: the key and the tenant are not among them. */
  readonly data: readonly string[];
}

const REFUSING =
  "select column_name from information_schema.columns where is_nullable = 'NO' and table_name = $1 and table_schema = ";

/**
 * Whether the table of a read model can hold the trace of a deleted row: every column of the
 * row accepts NULL, the key and the tenant apart. The columns are read once from the database,
 * before the first write of a trace, by the model or on the copy of a rebuild, which is made like
 * the table: a table that is not ready is refused by name instead of by a statement that would
 * abort the transaction of the event.
 */
export class TraceColumns {
  private ready = false;

  constructor(
    private readonly client: () => PrismaRawQueries,
    private readonly target: TracedTable,
  ) {}

  async require(): Promise<void> {
    if (this.ready) {
      return;
    }

    const { table, schema, data } = this.target;
    const refusing = await this.refusing();
    const named = data.filter((column) => refusing.has(column));

    if (named.length > 0) {
      throw new ReadModelTableNotReadyError(schema === undefined ? table : `${schema}.${table}`, named);
    }

    this.ready = true;
  }

  /** The columns of the table that refuse NULL. */
  private async refusing(): Promise<ReadonlySet<unknown>> {
    const { table, schema } = this.target;

    const rows: unknown =
      schema === undefined
        ? await this.client().$queryRawUnsafe(`${REFUSING}current_schema()`, table)
        : await this.client().$queryRawUnsafe(`${REFUSING}$2`, table, schema);

    const records: readonly unknown[] = Array.isArray(rows) ? rows : [];

    return new Set(records.map(columnNameOf));
  }
}

function columnNameOf(record: unknown): unknown {
  const name: unknown = Reflect.get(Object(record), 'column_name');

  return name;
}
