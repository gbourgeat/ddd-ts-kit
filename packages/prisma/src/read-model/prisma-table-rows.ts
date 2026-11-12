import type { EventStamp, PostgresTraceColumns, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import { quoted } from './quoted';
import type { RowMapper } from './row.mapper';
import { stampedRowOf } from './stamped-row-of';
import type { TenantOfRows } from './tenant-of-rows';
import { writtenOf } from './written-of';

export interface NamedTable<Row extends object> {
  /** The table, quoted and qualified. */
  readonly path: string;
  /** A field of the row, not a column. */
  readonly key: string;
  readonly mapper: RowMapper<Row>;
  /** The tenant of the rows, for a read model of tenant data. */
  readonly tenant: TenantOfRows;
  /** Of the table the copy is made like. */
  readonly traces: PostgresTraceColumns;
}

/**
 * The stamped rows of a table reached without a model, on PostgreSQL: the copy of a rebuild, and
 * the table itself for the trace of a deleted row, which holds SQL NULL in every column, a `Json`
 * one included, where the model would write a JSON `null`. Statements are written here with quoted identifiers that come from the options of the
 * adapter; every value is a `$n` parameter.
 */
export class PrismaTableRows<Row extends object, Tx extends PrismaRawQueries> implements ReadModelRows<Row> {
  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly target: NamedTable<Row>,
  ) {}

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const { path, mapper, tenant } = this.target;
    const reach = tenant.readingSql(2);

    const [record] = await this.run(
      `select * from ${path} where ${this.column(this.target.key)} = $1${reach.clause} limit 1`,
      [key, ...reach.values],
    );

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
    const record = await this.recordOf(entry);
    const columns = record.map(([column]) => quoted(column)).join(', ');
    const places = record.map((_, index) => `$${String(index + 1)}`).join(', ');
    const key = this.column(this.target.key);
    const row = `insert into ${this.target.path} (${columns}) values (${places})`;
    const values = record.map(([, value]) => value);

    const inserted = async (conflict: string): Promise<boolean> =>
      (await this.run(`${row} on conflict${conflict} do nothing returning ${key}`, values)).length === 1;

    // On the key alone, two writers of one key inserting at once may be refused on another unique
    // value of the row they both write. The first statement skips on any unique value; when it wrote
    // nothing, the second names the key: `false` for a key that is held, and the refusal of the
    // database for a value another row holds.
    return (await inserted('')) || inserted(` (${key})`);
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const record = await this.recordOf(entry);
    const changes = record.map(([column], index) => `${quoted(column)} = $${String(index + 1)}`).join(', ');
    const key = this.column(this.target.key);
    const next = (offset: number): string => `$${String(record.length + offset)}`;
    const own = this.target.tenant.writingSql(record.length + 5);

    const replaced = await this.run(
      `update ${this.target.path} set ${changes} where ${key} = ${next(1)} and "last_event_id" = ${next(2)} and "last_event_at" = ${next(3)} and "last_event_version" is not distinct from ${next(4)}::bigint${own.clause} returning ${key}`,
      [
        ...record.map(([, value]) => value),
        entry.key,
        held.eventId,
        held.occurredAt,
        held.version ?? null,
        ...own.values,
      ],
    );

    return replaced.length === 1;
  }

  /** Whether any row holds the key, whatever its tenant: what tells a conflict on the key from one on another unique value. */
  async holds(key: string): Promise<boolean> {
    const found = await this.run(
      `select 1 as held from ${this.target.path} where ${this.column(this.target.key)} = $1 limit 1`,
      [key],
    );

    return found.length === 1;
  }

  /**
   * What the entry writes, by column: its fields and stamps, and the tenant of the work for a read
   * model of tenant data. The trace of a deleted row is written once the table is known to accept it.
   */
  private async recordOf(entry: StampedRow<Row>): Promise<[string, unknown][]> {
    const { mapper, key, tenant, traces } = this.target;

    if (entry.row === undefined) {
      await traces.require();
    }

    return Object.entries({ ...mapper.toRecord(writtenOf(entry, key, mapper.fields())), ...tenant.written() });
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
