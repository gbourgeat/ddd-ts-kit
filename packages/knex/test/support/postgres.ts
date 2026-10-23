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

  await asAdmin(serverUrl, (admin) => admin.query(`create database ${name}`));
  const url = new URL(serverUrl);

  url.pathname = `/${name}`;

  return {
    url: url.toString(),
    real: true,
    poolSize: 5,
    stop: () => asAdmin(serverUrl, (admin) => dropOnceLeft(admin, name)),
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
