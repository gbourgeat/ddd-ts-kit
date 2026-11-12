import { randomBytes } from 'node:crypto';
import pg from 'pg';
{{#if tests.vitest}}
import type { TestProject } from 'vitest/node';
{{/if}}

/** Set here, read by the files (test-database-clone.ts): the template of the run and the pool of each file. The third is stated by whoever starts the run. */
export const RUN_TEMPLATE = 'TEST_DATABASE_RUN';
export const POOL_SIZE = 'TEST_DATABASE_POOL_SIZE';
const ALLOWED = 'TEST_DATABASE_CONNECTIONS';
/** A database of a run is named `<database>_test_<run>_<template or random>`, the migrated one cut to fit in 63 bytes; the template is its copy, emptied. */
const MARKER = '_test_';
const KEPT_OF_THE_NAME = 38;
const TEMPLATE = 'template';
/** The advisory lock a run holds as long as it lives, on the maintenance database: this number and the run. */
const LIVE = 0x64646b74;
/** The advisory lock held while a database is copied, with the run, or 0 while a run copies the migrated one. */
const COPYING = LIVE + 1;
/** The pool an application opens when nothing bounds it, and the one under which a request that waits for another never ends. */
const LARGEST_POOL = 10;
const SMALLEST_POOL = 2;
/** A migrated database holds a few megabytes: beyond this it holds rows, and the run says what copying them costs. */
const LARGE = 64 * 1024 * 1024;
/** The tables of the migration tool keep their rows: they say what was applied, no spec stores them. */
{{#if orm.drizzle}}
const KEPT = '__drizzle_migrations';
{{/if}}
{{#if orm.knex}}
const KEPT = 'knex_migrations, knex_migrations_lock';
{{/if}}
{{#if orm.prisma}}
const KEPT = '_prisma_migrations';
{{/if}}
{{#if orm.typeorm}}
const KEPT = 'migrations, typeorm_metadata';
{{/if}}
/** Where the end of the run waits for the global teardown, which Jest loads apart. */
const END = Symbol.for('ddd-ts-kit.test-database-run');
/** The SQLSTATE of a server that refuses to copy a database other sessions are connected to. */
const OTHER_SESSIONS = '55006';

/** The tables a run empties: every one but those of the migration tool and of an extension. */
const TABLES = `select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition and n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg\\_%' and c.relname <> all ('{${KEPT}}'::name[])
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')`;

/** How many tables the database holds, whichever, and the bytes of those the run empties. */
const HELD = `select (select count(*)::int from pg_class where relkind in ('r', 'p') and relnamespace not in ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)) as tables,
  (select coalesce(sum(pg_total_relation_size(oid)), 0) from (${TABLES}) emptied) as bytes`;

/** One transaction: a trigger that refuses a truncate, the guard of the audit trail, is off for it alone. */
const EMPTYING = `do $$ declare names text; guarded regclass; begin
  select string_agg(oid::regclass::text, ', ') into names from (${TABLES}) emptied;
  for guarded in select tgrelid from pg_trigger where not tgisinternal and (tgtype & 32) <> 0 loop
    execute format('alter table %s disable trigger user', guarded);
  end loop;
  if names is not null then execute 'truncate table ' || names || ' restart identity cascade'; end if;
  for guarded in select tgrelid from pg_trigger where not tgisinternal and (tgtype & 32) <> 0 loop
    execute format('alter table %s enable trigger user', guarded);
  end loop;
end $$`;

const REFUSALS: Readonly<Record<string, (database: string) => string>> = {
  [OTHER_SESSIONS]: (database) =>
    `The database "${database}" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.`,
  '42501': (database) =>
    `The role of DATABASE_URL may not copy the database "${database}", and each spec file runs on a copy of it: the role creates databases (alter role <role> createdb) and owns that one (alter database "${database}" owner to <role>).`,
  '3D000': (database) =>
    `The server of DATABASE_URL has no database "${database}": create it, then migrate it (npm run db:migrate).`,
};

{{#if tests.vitest}}
/**
 * A global setup of the end-to-end run (vitest.e2e.config.ts), which resolves its teardown. With
 * DATABASE_URL the files run on that server, and what takes time there is done here, once, where no
 * timeout of a hook applies; without it they run on PostgreSQL in process, and nothing is done.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const url = process.env['DATABASE_URL'] ?? '';

  return url === '' ? () => Promise.resolve() : startRun(url, project.config.maxWorkers);
}
{{/if}}
{{#if tests.jest}}
/**
 * The global setup of the end-to-end run on a server (jest.e2e.config.js names it when DATABASE_URL
 * is set): what takes time there is done here, once, where no timeout of a hook applies, and
 * test-database-teardown.ts ends the run. Jest resolves no alias in a global setup: this file
 * imports nothing of the project.
 */
export default async function setup(jest: { readonly maxWorkers: number }): Promise<void> {
  await startRun(process.env['DATABASE_URL'] ?? '', jest.maxWorkers);
}
{{/if}}

interface Run {
  readonly server: pg.Client;
  readonly url: string;
  readonly id: string;
}

/**
 * Starts the run on the server `url` names: drops what the runs that died left, checks that
 * `workers` files at once fit in the connections the server has left, then copies the migrated
 * database and empties the copy. Each file copies that template (test-database-clone.ts), which
 * takes a fraction of a second whatever the migrated database holds. The run holds an advisory lock
 * until its end, which is what it answers: that lock tells another run these databases are in use.
 */
export async function startRun(url: string, workers: number, tell = toErrorOutput): Promise<() => Promise<void>> {
  const server = await connectedTo(url);
  const run = { server, url, id: await lockedRun(server) };
  const end = (): Promise<void> => ended(run);

  try {
    await dropLeftovers(run);
    process.env[POOL_SIZE] = String(poolSizeFor(await connectionsLeft(server), workers));
    tell(await copyOfTheMigrated(run));
    process.env[RUN_TEMPLATE] = nameOf(url, run.id, TEMPLATE);
    Reflect.set(globalThis, END, end);
  } catch (error) {
    await end();

    throw error;
  }

  return end;
}

function toErrorOutput(line: string): void {
  process.stderr.write(line);
}

/** Drops the template of the run and what its files did not drop (one that failed while it started), then lets the lock go. */
async function ended(run: Run): Promise<void> {
  for (const name of await databasesOf(run)) {
    if (runOf(name, run.url) === run.id) {
      await run.server.query(dropping(name));
    }
  }

  Reflect.deleteProperty(globalThis, END);
  await run.server.end();
}

/** A session on the maintenance database of the server by default: one on the migrated database would make its copy refused. */
export async function connectedTo(url: string, database = maintenanceOf(url)): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: urlOf(url, database), keepAlive: true });

  await client.connect();

  return client;
}

/** A name no living run has, as the second key of its lock (a signed integer): the lock is taken before any database carries it. */
async function lockedRun(server: pg.Client): Promise<string> {
  const id = randomBytes(4).toString('hex');

  return (await locked(server, `pg_try_advisory_lock(${LIVE}, ${keyOf(id)})`)) ? id : lockedRun(server);
}

async function locked(server: pg.Client, lock: string): Promise<boolean> {
  const { rows } = await server.query<{ held: boolean }>(`select ${lock} as held`);

  return rows[0]?.held === true;
}

function keyOf(run: string): number {
  return Number.parseInt(run, 16) | 0;
}

/**
 * What the runs that died left: a database named after a run whose lock nobody holds, and that no
 * session is connected to. A run that lives holds its lock, so its databases stay, on this machine
 * or another one; a database with any other name is never dropped.
 */
async function dropLeftovers(run: Run): Promise<void> {
  const left = (await databasesOf(run)).filter((name) => runOf(name, run.url) !== undefined);

  for (const dead of new Set(left.map((name) => runOf(name, run.url) ?? ''))) {
    if (dead !== run.id && (await locked(run.server, `pg_try_advisory_lock(${LIVE}, ${keyOf(dead)})`))) {
      for (const name of left.filter((candidate) => runOf(candidate, run.url) === dead)) {
        // Without `force`: a session on it is a file that still runs, whatever became of its run.
        await run.server.query('drop database if exists ' + quoted(name)).catch(() => undefined);
      }

      await locked(run.server, `pg_advisory_unlock(${LIVE}, ${keyOf(dead)})`);
    }
  }
}

async function databasesOf({ server, url }: Run): Promise<string[]> {
  const { rows } = await server.query<{ datname: string }>('select datname from pg_database');

  return rows.map((row) => row.datname).filter((name) => name.startsWith(prefixOf(url)));
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

/**
 * The connections this run may open, and where the number comes from: what the server accepts, less
 * what it keeps for its administrators and what is open now, and no more than the limit of the role.
 * TEST_DATABASE_CONNECTIONS states it instead, for a server behind a pooler or shared with other runs.
 */
async function connectionsLeft(server: pg.Client): Promise<{ left: number; counted: string }> {
  const allowed = Number(process.env[ALLOWED] ?? '');

  if (Number.isInteger(allowed) && allowed > 0) {
    return { left: allowed, counted: `${ALLOWED} allows ${allowed}` };
  }

  const { rows } = await server.query<Record<'max' | 'reserved' | 'used' | 'role' | 'roleUsed', number>>(
    `select current_setting('max_connections')::int as max,
            current_setting('superuser_reserved_connections')::int + coalesce(current_setting('reserved_connections', true)::int, 0) as reserved,
            (select count(*)::int from pg_stat_activity where usesysid is not null and coalesce(backend_type, 'client backend') = 'client backend') as used,
            (select case when rolsuper then -1 else rolconnlimit end from pg_roles where rolname = current_user) as role,
            (select count(*)::int from pg_stat_activity where usename = current_user) as "roleUsed"`,
  );

  const [{ max, reserved, used, role, roleUsed } = { max: 0, reserved: 0, used: 0, role: -1, roleUsed: 0 }] = rows;
  const left = max - reserved - used;
  const ofRole = role - roleUsed;

  return role < 0 || ofRole >= left
    ? { left, counted: `the server leaves ${left} (max_connections ${max}, ${reserved} reserved, ${used} open)` }
    : { left: ofRole, counted: `the role leaves ${ofRole} (connection limit ${role}, ${roleUsed} open)` };
}

/**
 * The pool of each file: the connections left, shared between the files that run at once, 10 at
 * most. A run that does not fit is refused here with its numbers, before any file starts, instead
 * of `too many clients` from the driver in the middle of a spec.
 */
function poolSizeFor({ left, counted }: { left: number; counted: string }, workers: number): number {
  const each = Math.min(LARGEST_POOL, Math.floor(left / workers));
  const fitting = Math.floor(left / SMALLEST_POOL);
  const fewer = fitting > 0 ? `run at most ${fitting} at once (npm run test:e2e -- --maxWorkers=${fitting}), ` : '';

  if (each < SMALLEST_POOL) {
    throw new Error(
      `${workers} spec files at once need ${workers * SMALLEST_POOL} connections, ${SMALLEST_POOL} each at least, and ${counted}: ${fewer}raise max_connections, or state what the run may take (${ALLOWED}).`,
    );
  }

  return each;
}

/**
 * The template of the run: the migrated database copied once, one run at a time on the server
 * since two copies at once slow each other, then emptied. Answers what there is to say of a
 * database that holds rows, with what its copy took: the tests are better given one of their own.
 */
async function copyOfTheMigrated({ server, url, id }: Run): Promise<string> {
  const template = nameOf(url, id, TEMPLATE);
  const from = Date.now();

  await oneAtATime(server, '0', () => copied(server, databaseOf(url), template));

  const bytes = await emptied(url, template);
  const seconds = Math.ceil((Date.now() - from) / 1000);

  return bytes < LARGE
    ? ''
    : `The database "${databaseOf(url)}" holds ${Math.round(bytes / (1024 * 1024))} MB of rows: copying it took ${seconds} s of this run, and no spec file reads them, each runs on its tables, empty. Give the tests a database of their own, migrated and empty: create it, name it in DATABASE_URL, then npm run db:migrate.\n`;
}

/** Runs `work` while this session holds the copying lock of `run`: the next one waits for it. */
export async function oneAtATime(server: pg.Client, run: string, work: () => Promise<unknown>): Promise<void> {
  await server.query(`select pg_advisory_lock(${COPYING}, ${keyOf(run)})`);

  try {
    await work();
  } finally {
    await server.query(`select pg_advisory_unlock(${COPYING}, ${keyOf(run)})`);
  }
}

/**
 * Another session on the migrated database makes the server wait 5 seconds for it to leave, then
 * refuse: asked once more, since a migration or a console that was ending has ended by then.
 */
async function copied(server: pg.Client, database: string, template: string): Promise<void> {
  try {
    await server.query(copying(database, template)).catch((error: unknown) => {
      if (codeOf(error) !== OTHER_SESSIONS) {
        throw error;
      }

      return server.query(copying(database, template));
    });
  } catch (error) {
    const refusal = REFUSALS[codeOf(error)];

    throw refusal === undefined ? error : new Error(refusal(database), { cause: error });
  }
}

export function copying(from: string, to: string): string {
  return 'create database ' + quoted(to) + ' template ' + quoted(from);
}

export function dropping(name: string): string {
  return 'drop database if exists ' + quoted(name) + ' with (force)';
}

/**
 * Empties the template of the run, the audit trail included, and answers the bytes its tables held:
 * a file then starts from the tables of the migrated database and no row, as on PostgreSQL in
 * process, whatever a spec, an application or a migration stored there.
 */
async function emptied(url: string, name: string): Promise<number> {
  const template = await connectedTo(url, name);
  const database = databaseOf(url);

  try {
    const { rows } = await template.query<{ tables: number; bytes: string }>(HELD);

    if (rows[0]?.tables === 0) {
      throw new Error(`The database "${database}" holds no table: migrate it first (npm run db:migrate).`);
    }

    await template.query(EMPTYING);

    return Number(rows[0]?.bytes);
  } catch (error) {
    throw codeOf(error) === ''
      ? error
      : new Error(
          `The copy of the database "${database}" could not be emptied (${String(error)}): the role of DATABASE_URL owns its tables, or the tests are given a database of their own, migrated and empty.`,
          { cause: error },
        );
  } finally {
    await template.end();
  }
}

function codeOf(error: unknown): string {
  const code: unknown = error instanceof Error ? Reflect.get(error, 'code') : undefined;

  return typeof code === 'string' ? code : '';
}

function maintenanceOf(url: string): string {
  return databaseOf(url) === 'postgres' ? 'template1' : 'postgres';
}

function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export function urlOf(url: string, database: string): string {
  const address = new URL(url);

  address.pathname = '/' + encodeURIComponent(database);

  return address.toString();
}

function quoted(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}
