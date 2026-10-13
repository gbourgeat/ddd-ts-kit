import { randomBytes } from 'node:crypto';
import knex, { type Knex } from 'knex';
import type { TestDatabase } from '../database.js';

/**
 * A role of its own for the application, which row-level security applies to (a superuser
 * ignores every policy), granted what the given schemas hold, and a knex whose connections act
 * as it.
 */
export async function asApplicationRole(database: TestDatabase, schemas: readonly string[]): Promise<Knex> {
  const role = `tenant_app_${randomBytes(4).toString('hex')}`;

  await database.knex.raw(`create role ${role}`);

  for (const schema of schemas) {
    await database.knex.raw(`grant usage on schema ${schema} to ${role}`);
    await database.knex.raw(`grant all privileges on all tables in schema ${schema} to ${role}`);
  }

  return knex({
    client: 'pg',
    connection: database.url,
    pool: {
      min: 0,
      max: database.poolSize,
      afterCreate: (
        connection: { query: (sql: string, done: (error: Error | null) => void) => void },
        done: (error: Error | null, connection: unknown) => void,
      ) => {
        connection.query(`set role ${role}`, (error) => done(error, connection));
      },
    },
  });
}
