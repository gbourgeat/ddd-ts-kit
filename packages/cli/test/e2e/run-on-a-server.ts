import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { read, write } from '../helpers';
import { initProject } from '../support/init-project';

/** A PostgreSQL server whose user is a superuser, `postgres://app:app@localhost:5432`: the pipeline starts one. */
export const SERVER = process.env['DDD_TS_KIT_MIGRATIONS_SERVER'] ?? '';

/** The lock a run holds while it lives, as the support takes it: this number and the run. */
export const LIVE = 0x64646b74;

export interface DatabaseClone {
  readonly url: string;
  readonly poolSize: number;
  drop(): Promise<void>;
}

export interface Run {
  readonly template: string;
  readonly poolSize: number;
  end(): Promise<void>;
}

/** What a generated project runs its spec files on a server with. */
export interface Support {
  /** Where the project is. */
  readonly root: string;
  /** `test/support/test-database-setup.ts`, the global setup of the end-to-end run, as the runner loads it. */
  globalSetup(): Promise<unknown>;
  /** `test/support/test-database-run.ts`, as the global setup of an end-to-end run calls it. */
  openRun(url: string, atOnce: number, tell?: (line: string) => void): Promise<Run>;
  /** `test/support/test-database-clone.ts`, as a spec file calls it. */
  cloneDatabase(url: string): Promise<DatabaseClone>;
}

/** The project whose support is loaded, and the tables it lists as kept when they are not the generated ones. */
export interface Variant {
  readonly flags?: readonly string[];
  readonly kept?: readonly string[];
}

const SUPPORT = 'test/support';
const RESOLVED = 'test/support-resolved';
const KNEX = ['--orm', 'knex', '--audit', 'on'];

/** The runs the cases started: each is ended after its case, whatever the case asserted last. */
const started: Run[] = [];
const loaded = new Map<string, Promise<Support>>();

/** The support of a project, on Knex with an audit trail unless `flags` say otherwise, loaded once per variant. */
export function support({ flags = KNEX, kept }: Variant = {}): Promise<Support> {
  const key = JSON.stringify([flags, kept]);
  const known = loaded.get(key) ?? load(initProject(...flags), kept);

  loaded.set(key, known);

  return known;
}

/** What the global setup of an end-to-end run does once its run is open: the files find it in the environment. */
export function hand(run: Run): Run {
  process.env['TEST_DATABASE_RUN'] = run.template;
  process.env['TEST_DATABASE_POOL_SIZE'] = String(run.poolSize);

  return run;
}

/** Ends the runs a case left, and forgets what it stated and handed: called after each case. */
export async function endRuns(): Promise<void> {
  delete process.env['TEST_DATABASE_CONNECTIONS'];
  delete process.env['TEST_DATABASE_RUN'];
  delete process.env['TEST_DATABASE_POOL_SIZE'];

  for (const run of started.splice(0)) {
    await run.end();
  }
}

/**
 * The files of the support as the project holds them, in a copy where each import of a neighbour
 * names the copied file as Vite resolves it, `pg` is the package of the kit, and PostgreSQL in
 * process, which the kit does not install here, is not started.
 */
async function load(root: string, kept?: readonly string[]): Promise<Support> {
  const pgOfTheKit = pathToFileURL(createRequire(import.meta.url).resolve('pg')).href;

  for (const file of fs.readdirSync(path.join(root, SUPPORT))) {
    const source = read(root, `${SUPPORT}/${file}`)
      .replaceAll(/from '\.\/([^']+)'/g, "from './$1.ts'")
      .replace("from 'pg'", `from '${pgOfTheKit}'`);

    write(root, `${RESOLVED}/${file}`, source);
  }

  write(root, `${RESOLVED}/test-database-template.ts`, 'export default async function saveCluster() {}\n');

  if (kept !== undefined) {
    write(root, `${RESOLVED}/test-database-kept.ts`, `export const KEPT_TABLES = ${JSON.stringify(kept)};\n`);
  }

  const at = (file: string): string => pathToFileURL(path.join(root, RESOLVED, file)).href;
  const { openRun } = (await import(at('test-database-run.ts'))) as Pick<Support, 'openRun'>;
  const { cloneDatabase } = (await import(at('test-database-clone.ts'))) as Pick<Support, 'cloneDatabase'>;

  return {
    root,
    globalSetup: () => import(at('test-database-setup.ts')),
    openRun: async (...asked) => {
      const run = await openRun(...asked);

      started.push(run);

      return run;
    },
    cloneDatabase,
  };
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
 * A database as a migration leaves it: a table of the project and one that references it, the table
 * of the migration tool with its row, a list a migration filled, and an audit trail a trigger keeps
 * append-only. With `megabytes`, the rows an application or a spec left there, one of them in the trail.
 */
export async function migrated(database: string, { megabytes = 0 } = {}): Promise<void> {
  await onServer(`drop database if exists ${database} with (force)`);
  await onServer(`create database ${database}`);

  const statements = [
    'create table orders (id serial primary key, note text)',
    'create table order_lines (id serial primary key, order_id int references orders (id))',
    'create table countries (code text primary key)',
    "insert into countries values ('FR'), ('BE')",
    'create table knex_migrations (id serial primary key, name text)',
    "insert into knex_migrations (name) values ('20261112_create_orders.js')",
    'create materialized view orders_counted as select count(*)::int as orders from orders',
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
    'insert into order_lines (order_id) values (1)',
    'refresh materialized view orders_counted',
  ];
}

/**
 * The address of a migrated database owned by a role of its name, which is no superuser and may open
 * `connections`: it owns the tables of the project, and reads and appends to an audit trail the
 * superuser owns, as the README of the audit package lays the privileges out.
 */
export async function migratedByALimitedRole(name: string, connections: number): Promise<string> {
  await migrated(name, { megabytes: 1 });

  // What a run of that role left when it was killed is the role's: dropped before the role is.
  for (const left of await databasesLike(`${name}_test_`)) {
    await onServer(`drop database "${left}" with (force)`);
  }

  await onServer(`drop role if exists ${name}`);
  await onServer(`create role ${name} login password '${name}' createdb connection limit ${connections}`);
  await onServer(`alter database ${name} owner to ${name}`);

  const owned = ['table orders', 'table order_lines', 'table countries', 'table knex_migrations'];
  const granted = [`usage on schema audit to ${name}`, `select, insert on audit.audit_entries to ${name}`];

  for (const statement of [
    ...owned.map((one) => `alter ${one} owner to ${name}`),
    `alter materialized view orders_counted owner to ${name}`,
    ...granted.map((grant) => `grant ${grant}`),
  ]) {
    await rowsOf(urlOf(name), statement);
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

/** The one value a statement answers. */
export async function valueOf(url: string, statement: string): Promise<unknown> {
  const [row] = await rowsOf(url, statement);

  return Object.values(Object(row))[0];
}

export async function connected(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });

  await client.connect();

  return client;
}

export async function databasesLike(prefix: string): Promise<string[]> {
  const rows = await onServer(`select datname from pg_database where starts_with(datname, '${prefix}') order by 1`);

  return rows.map((row) => String(Reflect.get(Object(row), 'datname')));
}
