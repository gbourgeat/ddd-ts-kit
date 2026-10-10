import { and, eq, sql, type ExtractTablesWithRelations, type TablesRelationalConfig } from 'drizzle-orm';
import { getTableConfig, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  PostgresReadModelRebuild,
  type CriteriaPlan,
  type EventStamp,
  type ListedRows,
  type ReadModelRows,
  type ReadModelTable,
  type StampedRow,
  type TouchedKey,
} from '@ddd-ts-kit/kernel';
import type { DrizzleContext } from '../unit-of-work/drizzle-context.js';
import { criteriaToDrizzle } from './criteria-to-drizzle.js';
import type { DrizzleReadModelOptions } from './drizzle-read-model-options.js';
import { DrizzleStampedRows, type StampedTable } from './drizzle-stamped-rows.js';
import { RowMapper } from './row.mapper.js';
import { rowsOf } from './rows-of.js';
import { stampColumns } from './stamp-columns.js';

/**
 * The table of one read model on drizzle: what `TableReadModelStore` and `ProjectionRebuild`
 * are given. Every statement runs on the executor of the context, so a write made by a
 * projection commits with the processed mark of its event.
 */
export class DrizzleReadModelTable<
  Row extends object,
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
> implements ReadModelTable<Row>
{
  private readonly target: StampedTable;

  private readonly rows: DrizzleStampedRows<Row, Q, F, S>;

  private readonly copy: DrizzleStampedRows<Row, Q, F, S>;

  private readonly rebuild: PostgresReadModelRebuild;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    private readonly options: DrizzleReadModelOptions<Row>,
  ) {
    const { name, schema } = getTableConfig(options.table);

    this.target = { schema, name, key: options.key, columns: options.columns, stamps: stampColumns(options.table) };
    this.rows = new DrizzleStampedRows(context, this.target);
    this.copy = new DrizzleStampedRows(context, { ...this.target, name: PostgresReadModelRebuild.shadowOf(name) });

    this.rebuild = new PostgresReadModelRebuild((statement, parameters) => this.run(statement, parameters), {
      table: name,
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

  async list(plan: CriteriaPlan): Promise<ListedRows<Row>> {
    const { table, columns } = this.options;
    const { where, counted, orderBy, limit, offset } = criteriaToDrizzle(plan, columns);
    const kept = eq(this.target.stamps.deleted, false);
    const db = this.context.executor();
    const mapper = new RowMapper<Row>(columns);

    const records = await db
      .select(columns)
      .from(table)
      .where(and(kept, where))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const rows = records.map((record) => mapper.fromSelected(record));

    return plan.kind === 'cursor' ? { rows } : { rows, total: await db.$count(table, and(kept, counted)) };
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

  /** The text between the `$n` of a statement is raw SQL written by the kernel; each `$n` becomes a parameter. */
  private async run(
    statement: string,
    parameters: readonly (string | number)[],
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const pieces = statement.split(/\$\d+/);

    const query = sql.join(
      pieces.flatMap((piece, index) =>
        index < parameters.length ? [sql.raw(piece), sql`${parameters[index]}`] : [sql.raw(piece)],
      ),
      sql.raw(''),
    );

    return rowsOf(await this.context.executor().execute(query));
  }
}
