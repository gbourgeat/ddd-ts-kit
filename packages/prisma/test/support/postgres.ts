import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';

export interface TestPostgres {
  readonly url: string;
  /** True when `DDD_TS_KIT_TEST_DATABASE_URL` points the tests at a real server. */
  readonly real: boolean;
  /**
   * PGlite is a single session behind every socket: a second connection would step into the
   * transaction of the first. One connection there, several on a real server.
   */
  readonly poolSize: number;
  stop(): Promise<void>;
}

/**
 * A PostgreSQL endpoint for one spec file. By default PGlite served over the PostgreSQL wire
 * protocol on a free port, so no container is needed. With `DDD_TS_KIT_TEST_DATABASE_URL`, a
 * database of its own on that server, dropped at the end.
 */
export async function startPostgres(): Promise<TestPostgres> {
  const serverUrl = process.env['DDD_TS_KIT_TEST_DATABASE_URL'];
  return serverUrl === undefined || serverUrl === '' ? startPglite() : createDatabaseOn(serverUrl);
}

async function startPglite(): Promise<TestPostgres> {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 10 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
    real: false,
    poolSize: 1,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}

async function createDatabaseOn(serverUrl: string): Promise<TestPostgres> {
  const name = `ddd_ts_kit_test_${randomBytes(6).toString('hex')}`;
  const admin = async (statement: string): Promise<void> => {
    const client = new pg.Client({ connectionString: serverUrl });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  };
  await admin(`create database ${name}`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    real: true,
    poolSize: 5,
    stop: () => admin(`drop database if exists ${name} with (force)`),
  };
}
