import type { EventStamp, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { RowMapper } from './row.mapper';
import { stampedRowOf } from './stamped-row-of';
import { writtenOf } from './written-of';

export interface NamedTable<Row extends object> {
  /** The table, quoted and qualified. */
  readonly path: string;
  /** A field of the row, not a column. */
  readonly key: string;
  readonly mapper: RowMapper<Row>;
}

/**
 * The stamped rows of a table that has no model: the copy of a rebuild, on PostgreSQL.
 * Statements are written here with quoted identifiers that come from the options of the
 * adapter; every value is a `$n` parameter.
 */
export class PrismaTableRows<Row extends object, Tx extends PrismaRawQueries> implements ReadModelRows<Row> {
  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly target: NamedTable<Row>,
  ) {}

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const { path, mapper } = this.target;
    const [record] = await this.run(`select * from ${path} where ${this.column(this.target.key)} = $1 limit 1`, [key]);

    if (record === undefined) {
      return undefined;
    }

    return stampedRowOf({
      key,
      stamps: [record['last_event_id'], record['last_event_at'], record['last_event_version'], record['deleted']],
      row: () => mapper.fromRecord(record),
    });
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) {
      return false;
    }

    const record = Object.entries(this.target.mapper.toRecord(writtenOf(entry, this.target.key)));
    const columns = record.map(([column]) => quoted(column)).join(', ');
    const places = record.map((_, index) => `$${String(index + 1)}`).join(', ');
    const key = this.column(this.target.key);

    const inserted = await this.run(
      `insert into ${this.target.path} (${columns}) values (${places}) on conflict (${key}) do nothing returning ${key}`,
      record.map(([, value]) => value),
    );

    return inserted.length === 1;
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const record = Object.entries(this.target.mapper.toRecord(writtenOf(entry, this.target.key)));
    const changes = record.map(([column], index) => `${quoted(column)} = $${String(index + 1)}`).join(', ');
    const key = this.column(this.target.key);
    const next = (offset: number): string => `$${String(record.length + offset)}`;

    const replaced = await this.run(
      `update ${this.target.path} set ${changes} where ${key} = ${next(1)} and "last_event_id" = ${next(2)} and "last_event_at" = ${next(3)} returning ${key}`,
      [...record.map(([, value]) => value), entry.key, held.eventId, held.occurredAt],
    );

    return replaced.length === 1;
  }

  private column(field: string): string {
    return quoted(this.target.mapper.columnOf(field));
  }

  private async run(statement: string, values: readonly unknown[]): Promise<Readonly<Record<string, unknown>>[]> {
    const rows: unknown = await this.context.client().$queryRawUnsafe(statement, ...values);

    return Array.isArray(rows)
      ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
      : [];
  }
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
