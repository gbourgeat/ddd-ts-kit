import type { Knex } from 'knex';
import { tenantScopeOf, type EventStamp, type ReadModelRows, type StampedRow } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict.js';
import { TENANT_COLUMN, whereTenant } from '../tenancy/where-tenant.js';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import type { KnexReadModelOptions } from './knex-read-model-options.js';
import { recordsOf } from './records-of.js';
import { RowMapper } from './row.mapper.js';

/** The stamped rows of one table, the copy of a rebuild as well as the table itself. */
export class KnexStampedRows<Row extends object> implements ReadModelRows<Row> {
  private readonly mapper: RowMapper<Row>;

  constructor(
    private readonly context: KnexContext,
    private readonly options: KnexReadModelOptions<Row>,
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
        occurredAt: new Date(String(record['last_event_at'])),
        ...(version === null || version === undefined ? {} : { version: Number(version) }),
      },
    };
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) {
      return false;
    }

    return insertIgnoringConflict(this.context.executor(), this.table(), {
      row: this.recordOf(entry),
      conflict: this.keyColumn(),
    });
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const replaced: unknown = await this.writing()
      .where(this.keyColumn(), entry.key)
      .where('last_event_id', held.eventId)
      .where('last_event_at', held.occurredAt)
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

  private recordOf({ key, row, stamp }: StampedRow<Row>): Record<string, unknown> {
    const { tenant } = this.options;

    return {
      ...(row === undefined ? {} : this.mapper.toRecord(row)),
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
