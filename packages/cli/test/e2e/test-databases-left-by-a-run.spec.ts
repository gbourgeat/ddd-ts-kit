import { afterEach, describe, expect, it } from 'vitest';
import {
  connected,
  databaseOf,
  databasesLike,
  endRuns,
  hand,
  LIVE,
  migrated,
  onServer,
  rowsOf,
  type Run,
  SERVER,
  support,
  urlOf,
  valueOf,
} from './run-on-a-server';
import { SLOW } from './stacks';

const ON_A_SERVER = SLOW && SERVER !== '';

/** What a run says on its template, as the support writes it, with the clock of the server a moment or two minutes ago. */
const LIVING = `'ddd-ts-kit run ' || extract(epoch from now())::bigint`;
const LONG_AGO = `'ddd-ts-kit run ' || extract(epoch from now())::bigint - 120`;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): what the run of a generated
 * project drops, keeps, survives and refuses on a server, on a real PostgreSQL. A run that was
 * killed leaves its databases; another run of the same project may live at the same time, in
 * another checkout or on another machine; and a server may end the session a run holds its lock on.
 */
describe.runIf(ON_A_SERVER)('the databases a run left, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('are dropped by the next run when their run died, and kept for a run that holds its lock, one that just said it lives, a file still connected, another name', async () => {
    const { openRun, cloneDatabase } = await support();
    const url = urlOf('left_clean');
    const dead = ['left_clean_test_deadbeef_template', 'left_clean_test_deadbeef_0a0b0c0d'];
    const locked = 'left_clean_test_0badcafe_template';
    const beating = ['left_clean_test_5eed5eed_template', 'left_clean_test_5eed5eed_0a0b0c0d'];
    const connectedTo = 'left_clean_test_feedface_0a0b0c0d';
    const others = ['left_clean_test_data', 'left_clean_test_1794488410_0a0b0c0d'];
    const kept = [locked, ...beating, connectedTo, ...others].sort();

    await migrated('left_clean');
    await created([...dead, ...kept]);
    await said(dead[0], LONG_AGO);
    await said(locked, LONG_AGO);
    // A run between two sessions: its lock is free, and it said a moment ago that it lives.
    await said(beating[0], LIVING);

    const otherRun = await connected(urlOf('postgres'));
    const file = await connected(urlOf(connectedTo));

    await otherRun.query('select pg_advisory_lock($1, $2)', [LIVE, 0x0badcafe]);

    const from = Date.now();
    const run = hand(await openRun(url, 2));
    // A file of this run that fails while it starts never drops its copy.
    const abandoned = await cloneDatabase(url);

    // A database somebody is connected to is not asked to be dropped, which the server would take 5 seconds to refuse.
    expect(Date.now() - from).toBeLessThan(4000);
    expect(await databasesLike('left_clean_test_')).toEqual([...kept, run.template, databaseOf(abandoned.url)].sort());

    await run.end();

    expect(await databasesLike('left_clean_test_')).toEqual(kept);

    // The three runs ended without cleaning: the lock is let go, the last word is two minutes old, the file closed.
    await otherRun.end();
    await file.end();
    await said(beating[0], LONG_AGO);
    await (await openRun(url, 2)).end();

    expect(await databasesLike('left_clean_test_')).toEqual([...others].sort());

    await Promise.all(others.map((name) => onServer(`drop database ${name}`)));
  });
});

describe.runIf(ON_A_SERVER)('a run whose session the server ends, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('takes another session and its lock again, says on its template that it lives, and its files go on', async () => {
    const { openRun, cloneDatabase } = await support();
    const told: string[] = [];

    await migrated('left_lost');

    const run = hand(await openRun(urlOf('left_lost'), 2, (line) => told.push(line)));
    const first = await holderOf(run);

    expect(await valueOf(urlOf('postgres'), commentOf(run.template))).toMatch(/^ddd-ts-kit run \d+$/);

    await onServer(`select pg_terminate_backend(${first})`);
    await expect.poll(() => holderOf(run), { timeout: 15_000 }).toBeGreaterThan(0);

    expect(await holderOf(run)).not.toBe(first);
    expect(told.join('')).not.toContain('lost its session');

    const clone = await cloneDatabase(urlOf('left_lost'));

    await clone.drop();
    await run.end();

    expect(await databasesLike('left_lost_test_')).toEqual([]);
  });

  it('says that it lost its databases when it finds its template gone, and so does the file that cannot copy it', async () => {
    const { openRun, cloneDatabase } = await support();
    const told: string[] = [];

    await migrated('left_lost');

    const run = hand(await openRun(urlOf('left_lost'), 2, (line) => told.push(line)));
    const lost = `The run lost its databases: its template "${run.template}" is no longer on the server. A run whose session ended for more than a minute is held dead, and a later run drops what it left; an administrator may have dropped it too. Run again.`;

    // What a later run does to a run it holds dead, while this one has no session.
    await onServer(`drop database ${run.template}`);
    await onServer(`select pg_terminate_backend(${await holderOf(run)})`);

    await expect.poll(() => told.at(-1), { timeout: 15_000 }).toBe(lost + '\n');
    await expect(cloneDatabase(urlOf('left_lost'))).rejects.toThrow(lost);
  });

  it('copies the migrated database once more, on another session, when the server ends the one that copies it', async () => {
    const { openRun, cloneDatabase } = await support();
    const before = await connected(urlOf('postgres'));

    await migrated('left_lost', { megabytes: 1 });
    // Another run copies its own migrated database: this one waits its turn, on the session of its copy.
    await before.query('select pg_advisory_lock($1, 0)', [LIVE + 1]);

    const opening = openRun(urlOf('left_lost'), 1, () => undefined);
    const first = await waitingToCopy(0);

    await onServer(`select pg_terminate_backend(${first})`);

    expect(await waitingToCopy(first)).not.toBe(first);

    await before.end();

    hand(await opening);

    expect(await valueOf((await cloneDatabase(urlOf('left_lost'))).url, 'select count(*)::int from orders')).toBe(0);
  });

  it('ends without an error and drops its databases even when it ends before it has a session again', async () => {
    const { openRun, cloneDatabase } = await support();

    await migrated('left_lost');

    const run = hand(await openRun(urlOf('left_lost'), 2));

    await cloneDatabase(urlOf('left_lost'));
    await onServer(`select pg_terminate_backend(${await holderOf(run)})`);

    await expect(run.end()).resolves.toBeUndefined();
    expect(await databasesLike('left_lost_test_')).toEqual([]);
  });
});

describe.runIf(ON_A_SERVER)('what a run refuses before it starts, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('says that somebody is connected to the migrated database, which PostgreSQL then refuses to copy', async () => {
    const { openRun } = await support();

    await migrated('left_busy');

    const session = await connected(urlOf('left_busy'));

    try {
      await expect(openRun(urlOf('left_busy'), 2)).rejects.toThrow(
        'The database "left_busy" has other sessions (an application that runs, a console, a migration): PostgreSQL copies a database only while nobody else is connected to it. Close them, or give the tests a database of their own.',
      );
    } finally {
      await session.end();
    }

    expect(await databasesLike('left_busy_test_')).toEqual([]);
  });

  it('says to migrate a database that holds no table, to create one that is absent, and to name another one than "postgres"', async () => {
    const { openRun } = await support();

    await onServer('drop database if exists left_empty with (force)');
    await onServer('create database left_empty');

    await expect(openRun(urlOf('left_empty'), 2)).rejects.toThrow(
      'The database "left_empty" holds no table: migrate it first (pnpm run db:migrate).',
    );

    await expect(openRun(urlOf('left_absent'), 2)).rejects.toThrow(
      'The server of DATABASE_URL has no database "left_absent": create it, then migrate it (pnpm run db:migrate).',
    );

    await expect(openRun(urlOf('postgres'), 2)).rejects.toThrow(
      'DATABASE_URL names the database "postgres", where the runs hold their locks and which they copy from: give the tests a database of their own',
    );

    expect(await databasesLike('left_empty_test_')).toEqual([]);
  });
});

async function created(names: readonly string[]): Promise<void> {
  for (const name of names) {
    await onServer(`drop database if exists ${name} with (force)`);
    await onServer(`create database ${name}`);
  }
}

/** Writes the comment of a database as a run does, with the clock of the server. */
async function said(database: string | undefined, words: string): Promise<void> {
  await onServer(`do $$ begin execute format('comment on database %I is %L', '${database ?? ''}', ${words}); end $$`);
}

function commentOf(database: string): string {
  return `select shobj_description(oid, 'pg_database') from pg_database where datname = '${database}'`;
}

/** The session that waits for the lock under which a run copies its migrated database, other than `known`. */
async function waitingToCopy(known: number): Promise<number> {
  const waiting = `select pid from pg_locks where locktype = 'advisory' and classid = ${LIVE + 1} and objid = 0 and not granted and pid <> ${known}`;
  const pid = async (): Promise<number> => Number(Reflect.get(Object((await onServer(waiting))[0]), 'pid') ?? 0);

  await expect.poll(pid, { timeout: 15_000 }).toBeGreaterThan(0);

  return pid();
}

/** The session that holds the lock of the run, 0 when none does. */
async function holderOf({ template }: Run): Promise<number> {
  const run = Number.parseInt(/_test_([0-9a-f]{8})_template$/.exec(template)?.[1] ?? '', 16);

  const rows = await rowsOf(
    urlOf('postgres'),
    `select pid from pg_locks where locktype = 'advisory' and classid = ${LIVE} and objid = ${run} and granted`,
  );

  return Number(Reflect.get(Object(rows[0]), 'pid') ?? 0);
}
