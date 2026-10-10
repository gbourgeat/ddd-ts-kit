import type { EventStamp, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { PrismaContext } from '../unit-of-work/prisma-context.js';
import type { PrismaReadModelDelegate } from './prisma-read-model-delegate.js';
import type { PrismaReadModelOptions } from './prisma-read-model-options.js';
import { RowMapper } from './row.mapper.js';
import { stampedRowOf } from './stamped-row-of.js';
import { writtenOf } from './written-of.js';

/** The stamped rows of the table of a read model, through its model. */
export class PrismaModelRows<Row extends object, Tx> implements ReadModelRows<Row> {
  private readonly mapper: RowMapper<Row>;

  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly options: PrismaReadModelOptions<Row, Tx>,
  ) {
    this.mapper = new RowMapper<Row>(options.columns);
  }

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const [found] = await this.model().findMany({ where: { [this.keyField()]: key }, take: 1 });

    if (found === undefined) return undefined;

    const read = (field: string): unknown => Reflect.get(found, field);

    return stampedRowOf({ key, stamps: [read('lastEventId'), read('lastEventAt'), read('lastEventVersion'), read('deleted')], row: () => this.mapper.toRow(found) });
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    if (entry.row === undefined) return false;

    const { count } = await this.model().createMany({ data: [writtenOf(entry, this.keyField())], skipDuplicates: true });

    return count === 1;
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const { count } = await this.model().updateMany({
      where: { [this.keyField()]: entry.key, lastEventId: held.eventId, lastEventAt: held.occurredAt },
      data: writtenOf(entry, this.keyField()),
    });

    return count === 1;
  }

  model(): PrismaReadModelDelegate {
    return this.options.delegate(this.context.client());
  }

  private keyField(): string {
    return this.options.key ?? 'id';
  }
}
