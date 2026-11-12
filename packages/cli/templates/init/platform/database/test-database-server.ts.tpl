import pg from 'pg';

/** Set by the global setup of an end-to-end run, read by its files: the template of the run and the pool of each file. */
export const RUN_TEMPLATE = 'TEST_DATABASE_RUN';
export const POOL_SIZE = 'TEST_DATABASE_POOL_SIZE';

/** A database of a run is named `<database>_test_<run>_<template or random>`, the migrated one cut so that the name fits in 63 bytes. */
const MARKER = '_test_';
const KEPT_OF_THE_NAME = 38;

export const TEMPLATE = 'template';
/** The advisory lock a run holds as long as it lives, on the `postgres` database of the server: this number and the run. */
export const LIVE = 0x64646b74;

/** The advisory lock held while a database is copied, with the run, or 0 while a run copies the migrated one. */
const COPYING = LIVE + 1;

/**
 * What a role, a database or a server may set that ends a statement or a wait after some time
 * (`alter role ... set statement_timeout`), for the requests of an application: the sessions of a
 * run only copy, empty and drop its own databases and wait their turn to do so, which lasts as
 * long as the database is large, so none applies to them. Read from the settings the server has:
 * `transaction_timeout` came with PostgreSQL 17. These sessions open no transaction of their own:
 * `idle_in_transaction_session_timeout` never applies. The pool of an application under test is
 * another session, with the timeouts of its role.
 */
const NO_TIMEOUT = `select set_config(name, '0', false) from pg_settings where name in ('statement_timeout', 'lock_timeout', 'transaction_timeout')`;

/**
 * A session on a database of the server, `postgres` by default: the runs hold their locks there,
 * and copy and drop from there, since a session on a database makes its copy refused. A run
 * therefore cannot have `postgres` itself as its migrated database. No timeout of the role ends
 * what the session does.
 */
export async function connectedTo(url: string, database = 'postgres'): Promise<pg.Client> {
  if (databaseOf(url) === 'postgres') {
    throw new Error(
      'DATABASE_URL names the database "postgres", where the runs hold their locks and which they copy from: give the tests a database of their own (create database <name>, name it in DATABASE_URL, then npm run db:migrate).',
    );
  }

  const client = new pg.Client({ connectionString: urlOf(url, database), keepAlive: true });

  // A client whose session the server ended emits an error: with nobody listening, it would end the runner. Its queries reject.
  client.on('error', () => undefined);
  await client.connect();
  await client.query(NO_TIMEOUT);

  return client;
}

/** Runs `work` on a session of its own, ended whatever happens. */
export async function onServer(url: string, work: (server: pg.Client) => Promise<unknown>): Promise<void> {
  const server = await connectedTo(url);

  try {
    await work(server);
  } finally {
    await server.end();
  }
}

/** Whether the session took, or let go, the lock `call` names. */
export async function locked(server: pg.Client, call: string): Promise<boolean> {
  const { rows } = await server.query<{ held: boolean }>(`select ${call} as held`);

  return rows[0]?.held === true;
}

/** The run as the second key of a lock, a signed 32-bit integer. */
export function keyOf(run: string): number {
  return Number.parseInt(run, 16) | 0;
}

/** Runs `work` while this session holds the copying lock of `run`: two copies at once slow each other, the next one waits. */
export async function oneAtATime(server: pg.Client, run: string, work: () => Promise<unknown>): Promise<void> {
  await server.query(`select pg_advisory_lock(${COPYING}, ${keyOf(run)})`);

  try {
    await work();
  } finally {
    await server.query(`select pg_advisory_unlock(${COPYING}, ${keyOf(run)})`);
  }
}

/** The run a database belongs to, by its name; undefined for a database that is not one of a run on the database `url` names. */
export function runOf(name: string, url: string): string | undefined {
  const rest = name.startsWith(prefixOf(url)) ? name.slice(prefixOf(url).length) : '';

  return /^([0-9a-f]{8})_(?:template|[0-9a-f]{8})$/.exec(rest)?.[1];
}

export function nameOf(url: string, run: string, last: string): string {
  return prefixOf(url) + run + '_' + last;
}

function prefixOf(url: string): string {
  return databaseOf(url).slice(0, KEPT_OF_THE_NAME) + MARKER;
}

export function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** The same server, role and parameters, another database. */
export function urlOf(url: string, database: string): string {
  const address = new URL(url);

  address.pathname = '/' + encodeURIComponent(database);

  return address.toString();
}

export function copying(from: string, to: string): string {
  return 'create database ' + quoted(to) + ' template ' + quoted(from);
}

/** With `force`, whoever is still connected to it; without, only a database nobody is connected to. */
export function dropping(name: string, force = ' with (force)'): string {
  return 'drop database if exists ' + quoted(name) + force;
}

function quoted(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}

/** The SQLSTATE of a server that is asked for a database it does not have. */
export const NO_SUCH_DATABASE = '3D000';

/** Said by the run when it finds its template gone, and by a file that cannot copy it. */
export function lostDatabases(template: string): string {
  return `The run lost its databases: its template "${template}" is no longer on the server. A run whose session ended for more than a minute is held dead, and a later run drops what it left; an administrator may have dropped it too. Run again.`;
}

/** The SQLSTATE of an error of the server, empty for any other error. */
export function codeOf(error: unknown): string {
  const code: unknown = error instanceof Error ? Reflect.get(error, 'code') : undefined;

  return typeof code === 'string' ? code : '';
}
