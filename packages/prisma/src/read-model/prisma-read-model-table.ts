import {
  PostgresReadModelRebuild,
  type CriteriaPlan,
  type EventStamp,
  type SearchedRows,
  type ReadModelRows,
  type ReadModelTable,
  type StampedRow,
  type TouchedKey,
} from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import { criteriaToPrisma } from './criteria-to-prisma';
import { PrismaModelRows } from './prisma-model-rows';
import type { PrismaReadModelOptions } from './prisma-read-model-options';
import { PrismaTableRows } from './prisma-table-rows';
import { RowMapper } from './row.mapper';
import { TenantOfRows } from './tenant-of-rows';

const KEPT = { deleted: false };

/**
 * The table of one read model on Prisma: what `TableReadModelStore` and `ProjectionRebuild`
 * are given. Every statement runs on the client of the context, so a write made by a
 * projection commits with the processed mark of its event. The rebuild is PostgreSQL only.
 */
export class PrismaReadModelTable<Row extends object, Tx extends PrismaRawQueries> implements ReadModelTable<Row> {
  private readonly rows: PrismaModelRows<Row, Tx>;

  private readonly copy: PrismaTableRows<Row, Tx>;

  private readonly mapper: RowMapper<Row>;

  private readonly rebuild: PostgresReadModelRebuild;

  constructor(
    private readonly context: PrismaContext<Tx>,
    options: PrismaReadModelOptions<Row, Tx>,
  ) {
    const { table, schema } = options;
    const shadow = `"${PostgresReadModelRebuild.shadowOf(table).replaceAll('"', '""')}"`;

    this.mapper = new RowMapper<Row>(options.columns);
    this.rows = new PrismaModelRows(context, options);

    this.copy = new PrismaTableRows(context, {
      path: schema === undefined ? shadow : `"${schema.replaceAll('"', '""')}".${shadow}`,
      key: options.key ?? 'id',
      mapper: this.mapper,
      tenant: new TenantOfRows(options.tenant, options.columns),
    });

    this.rebuild = new PostgresReadModelRebuild((statement, parameters) => this.run(statement, parameters), {
      table,
      ...(schema === undefined ? {} : { schema }),
    });
  }

  find(key: string): Promise<StampedRow<Row> | undefined> {
    return this.rows.find(key);
  }

  insert(entry: StampedRow<Row>): Promise<boolean> {
    return this.rows.insert(entry);
  }

  replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    return this.rows.replace(entry, held);
  }

  async search(plan: CriteriaPlan): Promise<SearchedRows<Row>> {
    const { where, counted, orderBy, take, skip } = criteriaToPrisma(plan);
    const model = this.rows.model();
    const kept = [KEPT, this.rows.reading()];
    const found = await model.findMany({ where: { AND: [...kept, where] }, orderBy, take, skip });
    const rows = found.map((row) => this.mapper.toRow(row));

    return plan.kind === 'cursor'
      ? { rows }
      : { rows, total: await model.count({ where: { AND: [...kept, counted] } }) };
  }

  rebuilding(): Promise<boolean> {
    return this.rebuild.rebuilding();
  }

  touch(key: string): Promise<void> {
    return this.rebuild.touch(key);
  }

  beginRebuild(): Promise<void> {
    return this.rebuild.begin();
  }

  shadow(): ReadModelRows<Row> {
    return this.copy;
  }

  touched(limit: number): Promise<readonly TouchedKey[]> {
    return this.rebuild.touched(limit);
  }

  settle(keys: readonly TouchedKey[]): Promise<void> {
    return this.rebuild.settle(keys);
  }

  holdWriters(): Promise<void> {
    return this.rebuild.holdWriters();
  }

  promote(): Promise<void> {
    return this.rebuild.promote();
  }

  abandonRebuild(): Promise<void> {
    return this.rebuild.abandon();
  }

  private async run(
    statement: string,
    parameters: readonly (string | number)[],
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const rows: unknown = await this.context.client().$queryRawUnsafe(statement, ...parameters);

    return Array.isArray(rows)
      ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
      : [];
  }
}
