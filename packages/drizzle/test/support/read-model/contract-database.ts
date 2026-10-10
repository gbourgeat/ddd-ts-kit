import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleOverPg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
import { drizzle as drizzleOverPglite } from 'drizzle-orm/pglite';
import pg from 'pg';
import { createTableSql } from '../create-table-sql.js';
import { RecordingLogger } from '../recording-logger.js';

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

  await admin(serverUrl, `create database ${name}`);
  url.pathname = `/${name}`;

  const pool = new pg.Pool({ connectionString: url.toString(), max: 5 });

  return {
    db: drizzleOverPg(pool, { logger }) as unknown as ContractDb,
    real: true,
    logger,
    close: async () => {
      await pool.end();
      await admin(serverUrl, `drop database if exists ${name} with (force)`);
    },
  };
}

async function admin(serverUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: serverUrl });

  await client.connect();

  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}
