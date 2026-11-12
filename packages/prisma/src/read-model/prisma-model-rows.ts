import { UniqueViolationError, type EventStamp, type ReadModelRows, type StampedRow } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { PrismaReadModelDelegate } from './prisma-read-model-delegate';
import type { PrismaReadModelOptions } from './prisma-read-model-options';
import type { PrismaTableRows } from './prisma-table-rows';
import { RowMapper } from './row.mapper';
import { stampedRowOf } from './stamped-row-of';
import { TenantOfRows } from './tenant-of-rows';
import { writtenOf } from './written-of';

/**
 * The stamped rows of the table of a read model, through its model. The trace of a deleted row
 * is written on the table itself, by `traces`: SQL NULL in every column, which the model cannot
 * say of a `Json` field.
 */
export class PrismaModelRows<Row extends object, Tx extends PrismaRawQueries> implements ReadModelRows<Row> {
  private readonly mapper: RowMapper<Row>;

  private readonly tenant: TenantOfRows;

  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly options: PrismaReadModelOptions<Row, Tx>,
    private readonly traces: PrismaTableRows<Row, Tx>,
  ) {
    this.mapper = new RowMapper<Row>(options.columns);
    this.tenant = new TenantOfRows(options.tenant, options.columns);
  }

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const [found] = await this.model().findMany({ where: { [this.keyField()]: key, ...this.reading() }, take: 1 });

    if (found === undefined) {
      return undefined;
    }

    const read = (field: string): unknown => Reflect.get(found, field);

    return stampedRowOf({
      key,
      stamps: [read('lastEventId'), read('lastEventAt'), read('lastEventVersion'), read('deleted')],
      row: () => this.mapper.toRow(found),
    });
  }

  /**
   * `skipDuplicates` names no conflict target: when nothing was written and no row holds the key,
   * the row was skipped for another unique value, which is refused as the database would.
   */
  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) {
      return this.traces.insert(entry);
    }

    const { count } = await this.model().createMany({
      data: [{ ...this.written(entry), ...this.tenant.writing() }],
      skipDuplicates: true,
    });

    if (count === 0 && !(await this.traces.holds(entry.key))) {
      throw new UniqueViolationError(entry.key);
    }

    return count === 1;
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    if (entry.row === undefined) {
      return this.traces.replace(entry, held);
    }

    const own = this.tenant.writing();
    const written = this.written(entry);

    const { count } = await this.model().updateMany({
      where: { [this.keyField()]: entry.key, lastEventId: held.eventId, lastEventAt: held.occurredAt, ...own },
      data: { ...written, ...own },
    });

    return count === 1;
  }

  model(): PrismaReadModelDelegate {
    return this.options.delegate(this.context.client());
  }

  /** The condition of a read, by field: what the tenant of the work may see, or nothing for a read model of every tenant. */
  reading(): Readonly<Record<string, unknown>> {
    return this.tenant.reading();
  }

  private written(entry: StampedRow<Row>): Record<string, unknown> {
    return writtenOf(entry, this.keyField(), []);
  }

  private keyField(): string {
    return this.options.key ?? 'id';
  }
}
