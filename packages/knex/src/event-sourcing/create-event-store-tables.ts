import type { Knex } from 'knex';
import { eventStoreTablesSql, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';

/**
 * Creates the tables of the event store. Call it from a migration of the consuming project
 * (`export const up = (knex) => createEventStoreTables(knex, { schema: 'scheduling' })`), which
 * then owns the tables like any other.
 */
export async function createEventStoreTables(knex: Knex, options: EventStoreTablesOptions = {}): Promise<void> {
  for (const statement of eventStoreTablesSql(options)) {
    await knex.raw(statement);
  }
}
