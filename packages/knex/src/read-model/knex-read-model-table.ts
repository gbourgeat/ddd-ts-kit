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
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { criteriaToKnex } from './criteria-to-knex.js';
import type { KnexReadModelOptions } from './knex-read-model-options.js';
import { KnexStampedRows } from './knex-stamped-rows.js';
import { predicateToKnex } from './predicate-to-knex.js';
import { recordsOf } from './records-of.js';
import { RowMapper } from './row.mapper.js';

/**
 * The table of one read model on knex: what `TableReadModelStore` and `ProjectionRebuild` are
 * given. Every statement runs on the executor of the context, so a write made by a projection
 * commits with the processed mark of its event. The rebuild is PostgreSQL only.
 */
export class KnexReadModelTable<Row extends object> implements ReadModelTable<Row> {
  private readonly rows: KnexStampedRows<Row>;

  private readonly copy: KnexStampedRows<Row>;

  private readonly rebuild: PostgresReadModelRebuild;

  constructor(
    private readonly context: KnexContext,
    private readonly options: KnexReadModelOptions<Row>,
  ) {
    const { table, schema } = options;

    this.rows = new KnexStampedRows(context, options);
    this.copy = new KnexStampedRows(context, { ...options, table: PostgresReadModelRebuild.shadowOf(table) });
    this.rebuild = new PostgresReadModelRebuild((statement, parameters) => this.run(statement, parameters), { table, ...(schema === undefined ? {} : { schema }) });
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
    const { columns } = this.options;
    const mapper = new RowMapper<Row>(columns);
    const kept = () => this.rows.table().where('deleted', false);
    const answered: unknown = await criteriaToKnex(kept().select(Object.values<string>(columns)), plan, columns);
    const rows = recordsOf(answered).map((record) => mapper.toRow(record));

    if (plan.kind === 'cursor') return { rows };

    const counted: unknown = await predicateToKnex(kept(), plan.filter, columns).count({ total: '*' });

    return { rows, total: Number(recordsOf(counted)[0]?.['total'] ?? 0) };
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

  /** knex writes its bindings `?`: the statements of the rebuild name each of theirs once, in order. */
  private async run(statement: string, parameters: readonly (string | number)[]): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const result: unknown = await this.context.executor().raw(statement.replace(/\$\d+/g, '?'), [...parameters]);

    return recordsOf(typeof result === 'object' && result !== null && 'rows' in result ? result.rows : []);
  }
}
