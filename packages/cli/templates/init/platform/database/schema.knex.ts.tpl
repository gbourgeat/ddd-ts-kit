import type { Knex } from 'knex';
import { createOutboxTables } from '@ddd-ts-kit/knex';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export const MESSAGING = 'messaging';

/**
 * Every table of the application. The first migration (migrations/0001_initial.js) and the
 * in-process database of the tests both call it; once a database is shared, a change of an
 * existing table goes into a migration of its own (`npm run db:generate <name>`).
 */
export async function createTables(knex: Knex): Promise<void> {
  await createOutboxTables(knex, { schema: MESSAGING });
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
}
