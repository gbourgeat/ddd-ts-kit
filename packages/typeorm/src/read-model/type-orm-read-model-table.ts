import type { ObjectLiteral } from 'typeorm';
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
import type { TypeOrmContext } from '../unit-of-work/type-orm-context.js';
import { criteriaToTypeOrm } from './criteria-to-type-orm.js';
import { predicateToTypeOrm } from './predicate-to-type-orm.js';
import { RowMapper } from './row.mapper.js';
import type { TypeOrmReadModelOptions } from './type-orm-read-model-options.js';
import { TypeOrmStampedRows } from './type-orm-stamped-rows.js';

const ALIAS = 'row';

/**
 * The table of one read model on TypeORM: what `TableReadModelStore` and `ProjectionRebuild`
 * are given. Every statement runs on the manager of the context, so a write made by a
 * projection commits with the processed mark of its event. The rebuild is PostgreSQL only.
 */
export class TypeOrmReadModelTable<Row extends ObjectLiteral> implements ReadModelTable<Row> {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly options: TypeOrmReadModelOptions<Row>,
  ) {}

  find(key: string): Promise<StampedRow<Row> | undefined> {
    return this.rowsIn().find(key);
  }

  insert(entry: StampedRow<Row>): Promise<boolean> {
    return this.rowsIn().insert(entry);
  }

  replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    return this.rowsIn().replace(entry, held);
  }

  async search(plan: CriteriaPlan): Promise<SearchedRows<Row>> {
    const kept = () =>
      this.context
        .manager()
        .createQueryBuilder(this.options.entity, ALIAS)
        .where(`${ALIAS}.deleted = :kept`, { kept: false });

    const entities = await criteriaToTypeOrm(kept(), plan, { alias: ALIAS }).getMany();
    const rows = entities.map((entity) => this.mapper().fromEntity(entity));

    return plan.kind === 'cursor'
      ? { rows }
      : { rows, total: await predicateToTypeOrm(kept(), plan.filter, { alias: ALIAS }).getCount() };
  }

  rebuilding(): Promise<boolean> {
    return this.rebuild().rebuilding();
  }

  touch(key: string): Promise<void> {
    return this.rebuild().touch(key);
  }

  beginRebuild(): Promise<void> {
    return this.rebuild().begin();
  }

  shadow(): ReadModelRows<Row> {
    return this.rowsIn(PostgresReadModelRebuild.shadowOf(this.metadata().tableName));
  }

  touched(limit: number): Promise<readonly TouchedKey[]> {
    return this.rebuild().touched(limit);
  }

  settle(keys: readonly TouchedKey[]): Promise<void> {
    return this.rebuild().settle(keys);
  }

  holdWriters(): Promise<void> {
    return this.rebuild().holdWriters();
  }

  promote(): Promise<void> {
    return this.rebuild().promote();
  }

  abandonRebuild(): Promise<void> {
    return this.rebuild().abandon();
  }

  /** The metadata is read at each use: an entity is known to its data source once it is initialized. */
  private metadata() {
    return this.context.manager().dataSource.getMetadata(this.options.entity);
  }

  private mapper(): RowMapper<Row> {
    return new RowMapper<Row>(this.context.manager().dataSource.driver, this.metadata().columns);
  }

  /** The rows of the table, or of the copy of a rebuild when its name is given. */
  private rowsIn(copy?: string): TypeOrmStampedRows<Row> {
    const { schema, tableName } = this.metadata();
    const table = copy ?? tableName;

    return new TypeOrmStampedRows<Row>(this.context, {
      path: schema === undefined ? table : `${schema}.${table}`,
      key: this.options.key ?? 'id',
      mapper: this.mapper(),
      ...(copy === undefined ? { entity: this.options.entity } : {}),
    });
  }

  private rebuild(): PostgresReadModelRebuild {
    const { schema, tableName } = this.metadata();

    return new PostgresReadModelRebuild(
      async (statement, parameters) => {
        const rows: unknown = await this.context.manager().query(statement, [...parameters]);

        return Array.isArray(rows)
          ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
          : [];
      },
      { table: tableName, ...(schema === undefined ? {} : { schema }) },
    );
  }
}
