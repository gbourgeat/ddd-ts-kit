import type { EventStamp, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { PrismaReadModelDelegate } from './prisma-read-model-delegate';
import type { PrismaReadModelOptions } from './prisma-read-model-options';
import { RowMapper } from './row.mapper';
import { stampedRowOf } from './stamped-row-of';
import { TenantOfRows } from './tenant-of-rows';
import type { TraceColumns } from './trace-columns';
import { writtenOf } from './written-of';

/** The stamped rows of the table of a read model, through its model. */
export class PrismaModelRows<Row extends object, Tx> implements ReadModelRows<Row> {
  private readonly mapper: RowMapper<Row>;

  private readonly tenant: TenantOfRows;

  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly options: PrismaReadModelOptions<Row, Tx>,
    private readonly traces: TraceColumns,
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

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    const { count } = await this.model().createMany({
      data: [{ ...(await this.written(entry)), ...this.tenant.writing() }],
      skipDuplicates: true,
    });

    return count === 1;
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const own = this.tenant.writing();
    const written = await this.written(entry);

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

  /** What the entry writes, by field, once the table is known to accept the trace of a deleted row. */
  private async written(entry: StampedRow<Row>): Promise<Record<string, unknown>> {
    if (entry.row === undefined) {
      await this.traces.require();
    }

    return writtenOf(entry, this.keyField(), this.mapper.fields());
  }

  private keyField(): string {
    return this.options.key ?? 'id';
  }
}
