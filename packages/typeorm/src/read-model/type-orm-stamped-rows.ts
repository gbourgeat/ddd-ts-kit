import type { EntityManager, EntitySchema, ObjectLiteral, QueryBuilder } from 'typeorm';
import type { EventStamp, ReadModelRows, StampedRow } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context.js';
import type { RowMapper } from './row.mapper.js';

export interface StampedTable<Row extends object> {
  /** `schema.table`, or the table alone. */
  readonly path: string;
  /** The entity of the table. The copy of a rebuild has none: it is written by column. */
  readonly entity?: EntitySchema;
  /** A property of the entity, not a column. */
  readonly key: string;
  readonly mapper: RowMapper<Row>;
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
    const { path, mapper } = this.target;
    const manager = this.context.manager();

    const record: unknown = await manager
      .createQueryBuilder()
      .select('*')
      .from(path, 'held')
      .where(`${this.column(manager, 'held', this.target.key)} = :key`, { key })
      .getRawOne();

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
    if (entry.row === undefined) {
      return false;
    }

    const { path, entity, mapper } = this.target;
    const manager = this.context.manager();
    const insert = manager.createQueryBuilder().insert();
    const written = this.written(entry);
    const record = mapper.toRecord(written);

    return affected(
      manager,
      (entity === undefined
        ? insert.into(path, Object.keys(record)).values(record)
        : insert.into(entity).values(written)
      ).orIgnore(),
    );
  }

  async replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    const { path, entity, mapper } = this.target;
    const manager = this.context.manager();
    const column = (property: string): string => manager.dataSource.driver.escape(mapper.columnOf(property));
    const written = this.written(entry);

    const update =
      entity === undefined
        ? manager.createQueryBuilder().update(path).set(mapper.toRecord(written))
        : manager.createQueryBuilder().update(entity).set(written);

    void update
      .where(`${column(this.target.key)} = :key`, { key: entry.key })
      .andWhere(`${column('lastEventId')} = :heldId`, { heldId: held.eventId })
      .andWhere(`${column('lastEventAt')} = :heldAt`, { heldAt: held.occurredAt });

    return affected(manager, update);
  }

  private column(manager: EntityManager, alias: string, property: string): string {
    const { driver } = manager.dataSource;

    return `${driver.escape(alias)}.${driver.escape(this.target.mapper.columnOf(property))}`;
  }

  /** What the entry writes, by property. A removed row keeps its fields and changes its stamp only. */
  private written({ key, row, stamp }: StampedRow<Row>): Record<string, unknown> {
    return {
      ...row,
      [this.target.key]: key,
      lastEventId: stamp.eventId,
      lastEventAt: stamp.occurredAt,
      lastEventVersion: stamp.version ?? null,
      deleted: row === undefined,
    };
  }
}

/** Whether the statement wrote one row: the structured result of the query runner says it on every driver. */
async function affected(manager: EntityManager, builder: QueryBuilder<ObjectLiteral>): Promise<boolean> {
  const [statement, parameters] = builder.getQueryAndParameters();
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
