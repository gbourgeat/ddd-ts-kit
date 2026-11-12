import type { EntitySchemaColumnOptions, ObjectLiteral } from 'typeorm';
import {
  PostgresReadModelRebuild,
  PostgresTraceColumns,
  type TracedTable,
  ReadModelTableNotReadyError,
  type CriteriaPlan,
  type EventStamp,
  type SearchedRows,
  type ReadModelRows,
  type ReadModelTable,
  type ReadModelTableState,
  type StampedRow,
  type TouchedKey,
} from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { criteriaToTypeOrm } from './criteria-to-type-orm';
import { predicateToTypeOrm } from './predicate-to-type-orm';
import { RowMapper } from './row.mapper';
import { TenantOfRows } from './tenant-of-rows';
import type { TypeOrmReadModelOptions } from './type-orm-read-model-options';
import { TypeOrmStampedRows } from './type-orm-stamped-rows';

const ALIAS = 'row';

/**
 * The table of one read model on TypeORM: what `TableReadModelStore` and `ProjectionRebuild`
 * are given. Every statement runs on the manager of the context, so a write made by a
 * projection commits with the processed mark of its event. The rebuild is PostgreSQL only.
 */
export class TypeOrmReadModelTable<Row extends ObjectLiteral> implements ReadModelTable<Row> {
  private readonly tenant: TenantOfRows;

  private readonly traces = new PostgresTraceColumns(
    (statement, parameters) => this.run(statement, parameters),
    () => this.traced(),
  );

  constructor(
    private readonly context: TypeOrmContext,
    private readonly options: TypeOrmReadModelOptions<Row>,
  ) {
    this.tenant = new TenantOfRows(options.tenant);
    holdsTraces(context, options);
  }

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
    const reach = this.tenant.reading((property) => `${ALIAS}.${property}`);

    const kept = () => {
      const rows = this.context
        .manager()
        .createQueryBuilder(this.options.entity, ALIAS)
        .where(`${ALIAS}.deleted = :kept`, { kept: false });

      return reach === undefined ? rows : rows.andWhere(reach.clause, reach.parameters);
    };

    const entities = await criteriaToTypeOrm(kept(), plan, { alias: ALIAS }).getMany();
    const rows = entities.map((entity) => this.mapper().fromEntity(entity));

    return plan.kind === 'cursor'
      ? { rows }
      : { rows, total: await predicateToTypeOrm(kept(), plan.filter, { alias: ALIAS }).getCount() };
  }

  /** What the table can hold of the trace of a deleted row, read as before the first trace: what `ReadModelTables` asks. */
  tableState(): Promise<ReadModelTableState> {
    return this.traces.state();
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
      tenant: this.tenant,
      traces: this.traces,
      ...(copy === undefined ? { entity: this.options.entity } : {}),
    });
  }

  private rebuild(): PostgresReadModelRebuild {
    const { schema, tableName, columns } = this.metadata();

    return new PostgresReadModelRebuild((statement, parameters) => this.run(statement, parameters), {
      table: tableName,
      deletedColumn: deletedColumnOf(columns),
      ...(schema === undefined ? {} : { schema }),
    });
  }

  /** The table and the columns of the row, in which a trace holds NULL: every one but the key, the tenant and the stamp. */
  private traced(): TracedTable {
    const { schema, tableName, columns } = this.metadata();
    const kept = keptOf(this.options);
    const data = columns.filter((column) => !kept.has(column.propertyName)).map((column) => column.databaseName);

    return {
      table: tableName,
      data,
      deleted: deletedColumnOf(columns),
      ...(schema === undefined ? {} : { schema }),
    };
  }

  private async run(
    statement: string,
    parameters: readonly (string | number)[],
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const rows: unknown = await this.context.manager().query(statement, [...parameters]);

    return Array.isArray(rows)
      ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
      : [];
  }
}

const STAMPS: readonly string[] = ['lastEventId', 'lastEventAt', 'lastEventVersion', 'deleted'];

/**
 * Refuses, when the store is built, an entity whose columns could not hold the trace of a
 * deleted row: every column of the row is `nullable`, the key and the tenant apart. An early
 * signal: the database is asked before the first trace. The table and its columns are named as
 * the database will hold them, through the naming strategy of the data source, which is there
 * before the metadata of the entity is.
 */
function holdsTraces<Row>(context: TypeOrmContext, options: TypeOrmReadModelOptions<Row>): void {
  const { columns, schema, tableName, name } = options.entity.options;
  const { namingStrategy } = context.manager().dataSource;
  const kept = keptOf(options);
  const declared = Object.entries<EntitySchemaColumnOptions | undefined>(columns);

  const named = (property: string): string =>
    namingStrategy.columnName(property, declared.find(([name]) => name === property)?.[1]?.name, []);

  const data = declared.flatMap(([property, column]) =>
    column === undefined || kept.has(property) ? [] : [{ name: named(property), nullable: column.nullable }],
  );

  const refusing = data.filter((column) => column.nullable !== true).map((column) => column.name);

  if (refusing.length > 0) {
    throw new ReadModelTableNotReadyError({
      table: namingStrategy.tableName(name, tableName),
      exists: true,
      refusing,
      unfit: [],
      row: data.map((column) => column.name),
      deleted: named('deleted'),
      ...(schema === undefined ? {} : { schema }),
    });
  }
}

/** The properties a trace keeps: the stamp, the key and the tenant. */
function keptOf<Row>({ key, tenant }: TypeOrmReadModelOptions<Row>): ReadonlySet<string> {
  return new Set([...STAMPS, key ?? 'id', ...(tenant === undefined ? [] : [tenant.property ?? 'tenantId'])]);
}

/** The column of the mark of a deleted row, as the database holds it. */
function deletedColumnOf(columns: readonly { readonly propertyName: string; readonly databaseName: string }[]): string {
  return columns.reduce((name, column) => (column.propertyName === 'deleted' ? column.databaseName : name), 'deleted');
}
