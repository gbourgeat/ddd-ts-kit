import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleOverPg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
import { drizzle as drizzleOverPglite } from 'drizzle-orm/pglite';
import pg from 'pg';
import { createTableSql } from '../create-table-sql';
import { RecordingLogger } from '../recording-logger';

export type ContractDb = PgDatabase<PgQueryResultHKT>;

export interface ContractDatabase {
  readonly db: ContractDb;
  /** True when `DDD_TS_KIT_TEST_DATABASE_URL` points the tests at a real server. */
  readonly real: boolean;
  /** The statements drizzle sent, with their parameters apart. */
  readonly logger: RecordingLogger;
  close(): Promise<void>;
}

/**
 * One PostgreSQL database with the given tables: PGlite in process by default, a database of
 * its own on the server of `DDD_TS_KIT_TEST_DATABASE_URL` when it is set, dropped at the end.
 */
export async function createContractDatabase(tables: readonly PgTable[]): Promise<ContractDatabase> {
  const serverUrl = process.env['DDD_TS_KIT_TEST_DATABASE_URL'];
  const logger = new RecordingLogger();
  const database = serverUrl === undefined || serverUrl === '' ? inProcess(logger) : await onServer(serverUrl, logger);

  for (const statement of tables.flatMap(createTableSql)) {
    await database.db.execute(sql.raw(statement));
  }

  return database;
}

function inProcess(logger: RecordingLogger): ContractDatabase {
  const client = new PGlite();

  return {
    db: drizzleOverPglite(client, { logger }) as unknown as ContractDb,
    real: false,
    logger,
    close: () => client.close(),
  };
}

async function onServer(serverUrl: string, logger: RecordingLogger): Promise<ContractDatabase> {
  const name = `ddd_ts_kit_test_${randomBytes(6).toString('hex')}`;
  const url = new URL(serverUrl);

  await asAdmin(serverUrl, (admin) => admin.query(`create database ${name}`));
  url.pathname = `/${name}`;

  const pool = new pg.Pool({ connectionString: url.toString(), max: 5 });

  return {
    db: drizzleOverPg(pool, { logger }) as unknown as ContractDb,
    real: true,
    logger,
    close: async () => {
      await pool.end();
      await asAdmin(serverUrl, (admin) => dropOnceLeft(admin, name));
    },
  };
}

/**
 * The `end()` of a pg pool resolves once it has asked its connections to close, before their
 * backends have exited. Dropped with `force` at that moment, the database terminates them, and the
 * error each one then receives reaches a pool with no listener for it: an uncaught exception that
 * fails the run after every test passed. The database is dropped once no backend is left on it;
 * `force` stays for a connection a spec kept open, after a few seconds.
 */
async function dropOnceLeft(admin: pg.Client, name: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline && (await backendsOn(admin, name)) > 0) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  await admin.query(`drop database if exists ${name} with (force)`);
}

async function backendsOn(admin: pg.Client, name: string): Promise<number> {
  const { rows } = await admin.query<{ count: number }>(
    'select count(*)::int as count from pg_stat_activity where datname = $1',
    [name],
  );

  return rows[0]?.count ?? 0;
}

async function asAdmin(serverUrl: string, work: (admin: pg.Client) => Promise<unknown>): Promise<void> {
  const admin = new pg.Client({ connectionString: serverUrl });

  await admin.connect();

  try {
    await work(admin);
  } finally {
    await admin.end();
  }
}
