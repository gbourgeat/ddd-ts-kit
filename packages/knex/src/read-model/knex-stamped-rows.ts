import type { Knex } from 'knex';
import {
  tenantScopeOf,
  type EventStamp,
  type PostgresTraceColumns,
  type ReadModelRows,
  type StampedRow,
} from '@ddd-ts-kit/kernel';
import { dialectOf } from '../sql/dialect-of';
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict';
import { TENANT_COLUMN, whereTenant } from '../tenancy/where-tenant';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexReadModelOptions } from './knex-read-model-options';
import { recordsOf } from './records-of';
import { RowMapper } from './row.mapper';

/** The stamped rows of one table, the copy of a rebuild as well as the table itself. */
export class KnexStampedRows<Row extends object> implements ReadModelRows<Row> {
  private readonly mapper: RowMapper<Row>;

  constructor(
    private readonly context: KnexContext,
    private readonly options: KnexReadModelOptions<Row>,
    /** Of the table itself, which the copy of a rebuild is made like. */
    private readonly traces: PostgresTraceColumns,
  ) {
    this.mapper = new RowMapper<Row>(options.columns);
  }

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const answered: unknown = await this.reading().where(this.keyColumn(), key).limit(1);
    const [record] = recordsOf(answered);

    if (record === undefined) {
      return undefined;
    }

    const version = record['last_event_version'];

    return {
      key,
      row: record['deleted'] === true ? undefined : this.mapper.toRow(record),
      stamp: {
        eventId: String(record['last_event_id']),
        occurredAt: instantOf(record['last_event_at']),
        ...(version === null || version === undefined ? {} : { version: Number(version) }),
      },
    };
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    await this.holdsTrace(entry);

    const executor = this.context.executor();
    const row = this.recordOf(entry);
    const conflict = this.keyColumn();

    // On the key alone, two writers of one key inserting at once may be refused on another unique
    // value of the row they both write, on PostgreSQL. The first statement skips on any unique
    // value; when it wrote nothing, the second names the key: `false` for a key that is held, and
    // the refusal of the database for a value another row holds.
    if (dialectOf(executor) === 'postgres') {
      const inserted: unknown[] = await this.table().insert(row).onConflict().ignore().returning(conflict);

      if (inserted.length === 1) {
        return true;
      }
    }

    return insertIgnoringConflict(executor, this.table(), { row, conflict });
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    await this.holdsTrace(entry);

    const replaced: unknown = await this.writing()
      .where(this.keyColumn(), entry.key)
      .where('last_event_id', held.eventId)
      .where('last_event_at', held.occurredAt)
      // The whole stamp: null is written `is null`, so a row whose version alone moved is not replaced.
      .where('last_event_version', held.version ?? null)
      .update(this.recordOf(entry));

    return Number(replaced) === 1;
  }

  /** The table, on the executor of the current unit of work. */
  table(): Knex.QueryBuilder {
    const { table, schema } = this.options;
    const builder = this.context.executor()(table);

    return schema === undefined ? builder : builder.withSchema(schema);
  }

  /** What a read may reach: the table, confined to the tenant when the read model is of tenant data. */
  reading(): Knex.QueryBuilder {
    const { tenant } = this.options;

    return tenant === undefined ? this.table() : whereTenant(this.table(), tenant);
  }

  private writing(): Knex.QueryBuilder {
    const { tenant } = this.options;

    return tenant === undefined ? this.table() : this.table().where(TENANT_COLUMN, tenantScopeOf(tenant).tenantId);
  }

  /** Before the trace of a deleted row is written: the columns of the table accept it. */
  private async holdsTrace({ row }: StampedRow<Row>): Promise<void> {
    if (row === undefined) {
      await this.traces.require();
    }
  }

  private recordOf({ key, row, stamp }: StampedRow<Row>): Record<string, unknown> {
    const { tenant } = this.options;

    return {
      // A deleted row keeps no data: every column of the row is written NULL, not left to its default.
      ...(row === undefined ? this.mapper.toNulls() : this.mapper.toRecord(row)),
      ...(tenant === undefined ? {} : { [TENANT_COLUMN]: tenantScopeOf(tenant).tenantId }),
      [this.keyColumn()]: key,
      last_event_id: stamp.eventId,
      last_event_at: stamp.occurredAt,
      last_event_version: stamp.version ?? null,
      deleted: row === undefined,
    };
  }

  private keyColumn(): string {
    return this.options.keyColumn ?? 'id';
  }
}

/** The instant as the driver gave it: the text of a `Date` has no milliseconds, so a date is never read through it. */
function instantOf(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}
