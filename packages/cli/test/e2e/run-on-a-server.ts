import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { read } from '../helpers';
import { importGenerated } from '../support/import-generated';
import { initProject } from '../support/init-project';

/** A PostgreSQL server whose user is a superuser, `postgres://app:app@localhost:5432`: the pipeline starts one. */
export const SERVER = process.env['DDD_TS_KIT_MIGRATIONS_SERVER'] ?? '';

export interface DatabaseClone {
  readonly url: string;
  readonly poolSize: number;
  drop(): Promise<void>;
}

type End = () => Promise<void>;

/** What a generated project runs its end-to-end files on a server with: the global setup, and what each file calls. */
export interface Support {
  /** `test/support/test-database-run.ts`: what it answers ends the run. */
  startRun(url: string, workers: number, tell?: (line: string) => void): Promise<End>;
  /** `test/support/test-database-clone.ts`. */
  cloneDatabase(url: string): Promise<DatabaseClone>;
}

const RUN = 'test/support/test-database-run.ts';
const CLONE = 'test/support/test-database-clone.ts';

/** The runs the cases started: each is ended after its case, whatever the case asserted last. */
const started: End[] = [];

let loaded: Promise<Support> | undefined;

/** The support of a project on Knex, loaded once: the three other ORM differ by the tables of their migration tool. */
export function support(): Promise<Support> {
  loaded ??= load(initProject('--orm', 'knex'));

  return loaded;
}

/** Ends the runs a case left, and forgets what it stated of the connections: called after each case. */
export async function endRuns(): Promise<void> {
  delete process.env['TEST_DATABASE_CONNECTIONS'];

  for (const end of started.splice(0)) {
    await end();
  }
}

/**
 * Both files as the project holds them, `pg` taken from the kit: the file of the spec files
 * imports the one of the global setup by the alias of the tests, which nothing resolves here, so a
 * copy of it names that file instead.
 */
async function load(root: string): Promise<Support> {
  const run = (await importGenerated(root, RUN, [{ name: 'pg', from: 'cli' }])) as Pick<Support, 'startRun'>;
  const resolvedRun = pathToFileURL(path.join(root, RUN.replace(/\.ts$/, '.resolved.ts'))).href;
  const clone = path.join(root, CLONE.replace(/\.ts$/, '.resolved.ts'));

  fs.writeFileSync(clone, read(root, CLONE).replace("'$test/support/test-database-run'", `'${resolvedRun}'`));

  const { cloneDatabase } = (await import(pathToFileURL(clone).href)) as Pick<Support, 'cloneDatabase'>;

  return {
    startRun: async (...asked) => {
      const end = once(await run.startRun(...asked));

      started.push(end);

      return end;
    },
    cloneDatabase,
  };
}

/** A case ends its run to see what is left, and the run is ended once more after the case. */
function once(end: End): End {
  let ended: Promise<void> | undefined;

  return () => (ended ??= end());
}

/** The address of a database of the server, as its superuser or as `role`, whose password is its name. */
export function urlOf(database: string, role?: string): string {
  const address = new URL(`${SERVER}/${database}`);

  if (role !== undefined) {
    address.username = role;
    address.password = role;
  }

  return address.toString();
}

export function databaseOf(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * A database as a migration leaves it: a table of the project, the table of the migration tool with
 * its row, and an audit trail a trigger keeps append-only. With `megabytes`, the rows an application
 * or a spec left there, one of them in the trail.
 */
export async function migrated(database: string, { megabytes = 0 } = {}): Promise<void> {
  await onServer(`drop database if exists ${database} with (force)`);
  await onServer(`create database ${database}`);

  const statements = [
    'create table orders (id serial primary key, note text)',
    'create table knex_migrations (id serial primary key, name text)',
    "insert into knex_migrations (name) values ('20261112_create_orders.js')",
    'create schema audit',
    'create table audit.audit_entries (id serial primary key, entry text)',
    `create function audit.append_only() returns trigger language plpgsql as $$ begin raise exception 'audit_entries is append-only'; end $$`,
    'create trigger audit_entries_no_truncate before truncate on audit.audit_entries for each statement execute function audit.append_only()',
    ...(megabytes === 0 ? [] : rowsLeft(megabytes)),
  ];

  for (const statement of statements) {
    await rowsOf(urlOf(database), statement);
  }
}

/** A row holds about 300 bytes: an md5 eight times, its header and its id. */
function rowsLeft(megabytes: number): string[] {
  return [
    "insert into audit.audit_entries (entry) values ('left by an application')",
    `insert into orders (note) select repeat(md5(g::text), 8) from generate_series(1, ${megabytes * 3600}) g`,
  ];
}

/** The address of a migrated database owned by a role of its name, which is no superuser and may open nine connections. */
export async function migratedByALimitedRole(name: string): Promise<string> {
  await migrated(name);
  await onServer(`drop role if exists ${name}`);
  await onServer(`create role ${name} login password '${name}' createdb connection limit 9`);
  await onServer(`alter database ${name} owner to ${name}`);

  for (const owned of ['schema audit', 'table orders', 'table knex_migrations', 'table audit.audit_entries']) {
    await rowsOf(urlOf(name), `alter ${owned} owner to ${name}`);
  }

  return urlOf(name, name);
}

export async function onServer(statement: string): Promise<unknown[]> {
  return rowsOf(urlOf('postgres'), statement);
}

export async function rowsOf(url: string, statement: string): Promise<unknown[]> {
  const client = await connected(url);

  try {
    return (await client.query(statement)).rows;
  } finally {
    await client.end();
  }
}

export async function connected(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });

  await client.connect();

  return client;
}

export async function sizeOf(database: string): Promise<number> {
  const [row] = await onServer(`select pg_database_size('${database}')::float8 as bytes`);

  return Number(Reflect.get(Object(row), 'bytes'));
}

export async function databasesLike(prefix: string): Promise<string[]> {
  const rows = await onServer(`select datname from pg_database where starts_with(datname, '${prefix}') order by 1`);

  return rows.map((row) => String(Reflect.get(Object(row), 'datname')));
}
