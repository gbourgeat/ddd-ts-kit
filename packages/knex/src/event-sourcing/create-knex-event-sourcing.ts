import { postgresEventSourcing, type EventSourcingStores, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';
import { dialectOf } from '../sql/dialect-of.js';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { knexSqlRun } from './knex-sql-run.js';

/**
 * The event store, the snapshots, the checkpoints and the keys of the data subjects on
 * PostgreSQL, through knex. Every statement runs on the executor of the context, so an append
 * joins the transaction of the unit of work, with the outbox. Bind each one to its port.
 */
export function createKnexEventSourcing(
  context: KnexContext,
  options: EventStoreTablesOptions = {},
): EventSourcingStores {
  const dialect = dialectOf(context.executor());

  if (dialect !== 'postgres') {
    throw new TypeError(`The event store of @ddd-ts-kit/knex runs on PostgreSQL, and this knex speaks ${dialect}`);
  }

  return postgresEventSourcing(knexSqlRun(context), options);
}
