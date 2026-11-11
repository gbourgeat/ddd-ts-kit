import type { EntityManager, EntitySchema, ObjectLiteral, QueryBuilder, WhereExpressionBuilder } from 'typeorm';
import type { EventStamp, PostgresTraceColumns, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import type { RowMapper } from './row.mapper';
import type { TenantCondition, TenantOfRows } from './tenant-of-rows';

export interface StampedTable<Row extends object> {
  /** `schema.table`, or the table alone. */
  readonly path: string;
  /** The entity of the table. The copy of a rebuild has none: it is written by column. */
  readonly entity?: EntitySchema;
  /** A property of the entity, not a column. */
  readonly key: string;
  readonly mapper: RowMapper<Row>;
  /** The tenant of the rows, for a read model of tenant data. */
  readonly tenant: TenantOfRows;
  /** Of the table itself, which the copy of a rebuild is made like. */
  readonly traces: PostgresTraceColumns;
}

/**
 * The stamped rows of one table, the copy of a rebuild as well as the table itself: the
 * table is named, since the copy has no entity of its own. Statements are made by the query
 * builder, every value a parameter.
 */
export class TypeOrmStampedRows<Row extends object> implements ReadModelRows<Row> {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly target: StampedTable<Row>,
  ) {}

  async find(key: string): Promise<StampedRow<Row> | undefined> {
    const { path, mapper, tenant } = this.target;
    const manager = this.context.manager();

    const query = manager
      .createQueryBuilder()
      .select('*')
      .from(path, 'held')
      .where(`${this.column(manager, 'held', this.target.key)} = :key`, { key });

    const reach = tenant.reading((property) => this.column(manager, 'held', property));
    const record: unknown = await confined(query, reach).getRawOne();

    if (typeof record !== 'object' || record === null) {
      return undefined;
    }

    const read = (property: string): unknown => mapper.read({ ...record }, property);
    const version = read('lastEventVersion');

    return {
      key,
      row: read('deleted') === true ? undefined : mapper.toRow({ ...record }),
      stamp: {
        eventId: String(read('lastEventId')),
        occurredAt: new Date(String(read('lastEventAt'))),
        ...(version === null ? {} : { version: Number(version) }),
      },
    };
  }

  async insert(entry: StampedRow<Row>): Promise<boolean> {
    const { path, entity, mapper } = this.target;
    const manager = this.context.manager();
    const insert = manager.createQueryBuilder().insert();
    const written = await this.written(entry);
    const record = mapper.toRecord(written);

    const ignoring = (
      entity === undefined ? insert.into(path, Object.keys(record)).values(record) : insert.into(entity).values(written)
    ).orIgnore();

    return affected(manager, ignoring, onKeyAlone(manager, mapper.columnOf(this.target.key)));
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const { path, entity, mapper, tenant } = this.target;
    const manager = this.context.manager();
    const column = (property: string): string => manager.dataSource.driver.escape(mapper.columnOf(property));
    const written = await this.written(entry);

    const update =
      entity === undefined
        ? manager.createQueryBuilder().update(path).set(mapper.toRecord(written))
        : manager.createQueryBuilder().update(entity).set(written);

    void update
      .where(`${column(this.target.key)} = :key`, { key: entry.key })
      .andWhere(`${column('lastEventId')} = :heldId`, { heldId: held.eventId })
      .andWhere(`${column('lastEventAt')} = :heldAt`, { heldAt: held.occurredAt });

    return affected(manager, confined(update, tenant.writing(column)));
  }

  private column(manager: EntityManager, alias: string, property: string): string {
    const { driver } = manager.dataSource;

    return `${driver.escape(alias)}.${driver.escape(this.target.mapper.columnOf(property))}`;
  }

  /**
   * What the entry writes, by property: a removed row keeps no data, each of its fields is
   * written NULL and not left to its default; tenant data carries the tenant of the work.
   */
  private async written({ key, row, stamp }: StampedRow<Row>): Promise<Record<string, unknown>> {
    if (row === undefined) {
      await this.target.traces.require();
    }

    return {
      ...(row ?? this.target.mapper.toNulls()),
      [this.target.key]: key,
      lastEventId: stamp.eventId,
      lastEventAt: stamp.occurredAt,
      lastEventVersion: stamp.version ?? null,
      deleted: row === undefined,
      ...this.target.tenant.written(),
    };
  }
}

/** The statement confined to the tenants of the work, when the read model is of tenant data. */
function confined<Builder extends WhereExpressionBuilder>(
  builder: Builder,
  condition: TenantCondition | undefined,
): Builder {
  if (condition !== undefined) {
    void builder.andWhere(condition.clause, condition.parameters);
  }

  return builder;
}

/** Whether the statement wrote one row: the structured result of the query runner says it on every driver. */
async function affected(
  manager: EntityManager,
  builder: QueryBuilder<ObjectLiteral>,
  rewritten: (statement: string) => string = (statement) => statement,
): Promise<boolean> {
  const [built, parameters] = builder.getQueryAndParameters();
  const statement = rewritten(built);
  const transactional = manager.queryRunner;
  const runner = transactional ?? manager.dataSource.createQueryRunner();

  try {
    const result = await runner.query(statement, parameters, true);

    return result.affected === 1;
  } finally {
    if (transactional === undefined) {
      await runner.release();
    }
  }
}

/**
 * `orIgnore` names no conflict target, so it would also skip a row that takes a unique value
 * another row holds: the key is named, and that other conflict is refused by the database.
 */
function onKeyAlone(manager: EntityManager, keyColumn: string): (statement: string) => string {
  const key = manager.dataSource.driver.escape(keyColumn);

  return (statement) => statement.replace(' ON CONFLICT DO NOTHING', ` ON CONFLICT (${key}) DO NOTHING`);
}
