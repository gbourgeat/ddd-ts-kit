import { postgresEventSourcing, type EventSourcingStores, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';

/**
 * The event store, the snapshots, the checkpoints and the keys of the data subjects on
 * PostgreSQL, through the entity manager of the context, over the tables of
 * `eventStoreEntities`. Every statement runs on that manager, so an append joins the
 * transaction of the unit of work, with the outbox. Bind each one to its port.
 */
export function createTypeOrmEventSourcing(
  context: TypeOrmContext,
  options: EventStoreTablesOptions = {},
): EventSourcingStores {
  return postgresEventSourcing(async (statement, parameters) => {
    const manager = context.manager();

    if (manager.dataSource.options.type !== 'postgres') {
      throw new TypeError(
        `The event store of @ddd-ts-kit/typeorm runs on PostgreSQL, not on ${manager.dataSource.options.type}`,
      );
    }

    return recordsOf(await manager.query(statement, [...parameters]));
  }, options);
}

/** TypeORM answers an UPDATE or a DELETE on PostgreSQL as `[rows, count]`, anything else as the rows. */
function recordsOf(answered: unknown): Readonly<Record<string, unknown>>[] {
  const counted = Array.isArray(answered) && answered.length === 2 && typeof answered[1] === 'number';
  const rows: unknown = counted ? answered[0] : answered;
  const list: readonly unknown[] = Array.isArray(rows) ? rows : [];

  return list.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null);
}
