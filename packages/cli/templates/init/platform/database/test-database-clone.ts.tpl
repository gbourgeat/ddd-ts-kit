import { randomBytes } from 'node:crypto';
import pg from 'pg';

/** The database of one spec file, on the server the run was given. */
export interface DatabaseClone {
  readonly url: string;

  /** Drops the database, whoever is still connected to it. */
  drop(): Promise<void>;
}

/** What follows the name of the migrated database in the name of a copy: `<database>_test_<seconds of its date>_<random>`. */
const MARKER = '_test_';
/** PostgreSQL keeps 63 bytes of a name: the migrated one is cut so that what follows it always fits. */
const KEPT_OF_THE_NAME = 38;
/** No spec file runs for an hour: a copy that old was left by a run that was killed. */
const LEFTOVER_AFTER_SECONDS = 3600;
/** The SQLSTATE of a server that refuses to copy a database other sessions are connected to. */
const OTHER_SESSIONS = '55006';

const REFUSALS: Readonly<Record<string, (database: string) => string>> = {
  [OTHER_SESSIONS]: (database) =>
    `The database "${database}" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.`,
  '42501': (database) =>
    `The role of DATABASE_URL may not copy the database "${database}", and each spec file runs on a copy of it: the role creates databases (alter role <role> createdb) and owns that one (alter database "${database}" owner to <role>).`,
  '3D000': (database) =>
    `The server of DATABASE_URL has no database "${database}": create it, then migrate it (npm run db:migrate).`,
};

/**
 * A copy of the migrated database `url` names (`create database ... template`), for one spec file:
 * files then run at the same time on one server, two runs at once never wait for each other, and
 * nothing a file stores reaches another. The migrated database itself is only read. A copy is
 * dropped when its file closes it; the ones a killed run left are dropped here, an hour later.
 */
export async function cloneDatabase(url: string): Promise<DatabaseClone> {
  const database = databaseOf(url);
  const name = copyName(database, secondsNow());

  await onServer(url, async (server) => {
    await dropLeftovers(server, database);
    await copy(server, database, name);
  });

  const clone = { url: urlOf(url, name), drop: () => onServer(url, (server) => drop(server, name)) };

  await refuseWithoutTable(clone, database);

  return clone;
}

/**
 * Runs `work` on a connection of its own to the maintenance database of the server, never to the
 * migrated one: PostgreSQL refuses to copy a database another session is connected to, and the
 * files that start together would be those sessions for one another.
 */
async function onServer(url: string, work: (server: pg.Client) => Promise<void>): Promise<void> {
  const server = new pg.Client({ connectionString: urlOf(url, maintenanceDatabaseOf(url)) });

  await server.connect();

  try {
    await work(server);
  } finally {
    await server.end();
  }
}

/** Only what carries the name the kit gives a copy of this database, with a date an hour old, is ever dropped. */
async function dropLeftovers(server: pg.Client, database: string): Promise<void> {
  const { rows } = await server.query<{ datname: string }>('select datname from pg_database');
  const oldest = secondsNow() - LEFTOVER_AFTER_SECONDS;

  for (const { datname } of rows) {
    const created = createdAt(datname, database);

    if (created !== undefined && created < oldest) {
      // Another file of the run may be dropping the same one.
      await drop(server, datname).catch(() => undefined);
    }
  }
}

/**
 * Another session on the migrated database makes the server wait 5 seconds for it to leave, then
 * refuse: asked once more, since a migration or a console that was ending has ended by then.
 */
async function copy(server: pg.Client, database: string, name: string): Promise<void> {
  const statement = 'create database ' + quoted(name) + ' template ' + quoted(database);

  try {
    await server.query(statement).catch((error: unknown) => {
      if (codeOf(error) !== OTHER_SESSIONS) {
        throw error;
      }

      return server.query(statement);
    });
  } catch (error) {
    throw refusalOf(error, database);
  }
}

async function drop(server: pg.Client, name: string): Promise<void> {
  await server.query('drop database if exists ' + quoted(name) + ' with (force)');
}

/** A server nobody migrated answers `relation does not exist` at the first statement of a spec: said here, with the command. */
async function refuseWithoutTable(clone: DatabaseClone, database: string): Promise<void> {
  const connection = new pg.Client({ connectionString: clone.url });

  await connection.connect();

  const { rows } = await connection.query(
    "select 1 from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema') limit 1",
  );

  await connection.end();

  if (rows.length === 0) {
    await clone.drop();

    throw new Error(`The database "${database}" holds no table: migrate it first (npm run db:migrate).`);
  }
}

function refusalOf(error: unknown, database: string): unknown {
  const refusal = REFUSALS[codeOf(error)];

  return refusal === undefined ? error : new Error(refusal(database), { cause: error });
}

/** The SQLSTATE of an error of the server, empty for any other error. */
function codeOf(error: unknown): string {
  const code: unknown = error instanceof Error ? Reflect.get(error, 'code') : undefined;

  return typeof code === 'string' ? code : '';
}

function copyName(database: string, seconds: number): string {
  return prefixOf(database) + String(seconds) + '_' + randomBytes(4).toString('hex');
}

/** When the copy named `name` was made, in seconds; undefined for a database that is not a copy of `database`. */
function createdAt(name: string, database: string): number | undefined {
  const prefix = prefixOf(database);
  const [seconds, random, ...rest] = name.slice(prefix.length).split('_');

  if (!name.startsWith(prefix) || seconds === undefined || random === undefined || rest.length > 0) {
    return undefined;
  }

  return /^\d{10}$/.test(seconds) && /^[0-9a-f]{8}$/.test(random) ? Number(seconds) : undefined;
}

function prefixOf(database: string): string {
  return database.slice(0, KEPT_OF_THE_NAME) + MARKER;
}

function secondsNow(): number {
  return Math.floor(Date.now() / 1000);
}

function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** `postgres`, which every server has; `template1` when the migrated database is that one. */
function maintenanceDatabaseOf(url: string): string {
  return databaseOf(url) === 'postgres' ? 'template1' : 'postgres';
}

/** The same server, role and parameters, another database. */
function urlOf(url: string, database: string): string {
  const address = new URL(url);

  address.pathname = '/' + encodeURIComponent(database);

  return address.toString();
}

function quoted(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}
