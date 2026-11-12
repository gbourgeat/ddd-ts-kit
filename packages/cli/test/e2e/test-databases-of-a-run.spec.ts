import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import {
  databaseOf,
  databasesLike,
  endRuns,
  migrated,
  migratedByALimitedRole,
  rowsOf,
  SERVER,
  sizeOf,
  support,
  urlOf,
} from './run-on-a-server';
import { SLOW } from './stacks';

const MEGABYTE = 1024 * 1024;

const ON_A_SERVER = SLOW && SERVER !== '';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): the support a generated project
 * runs its end-to-end files with on a server, called as its global setup and its files call it, on a
 * real PostgreSQL. Here, a migrated database that holds rows and a server with few connections
 * left; test-databases-left-by-a-run.spec.ts holds what a killed run leaves and what is refused.
 */
describe.runIf(ON_A_SERVER)('the database of a spec file, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('is the tables of the migrated database, empty, in a fraction of the time that one takes to copy', async () => {
    const { startRun, cloneDatabase } = await support();
    const told: string[] = [];

    await migrated('copies_large', { megabytes: 80 });

    const end = await startRun(urlOf('copies_large'), 4, (line) => told.push(line));
    const files = await Promise.all([1, 2, 3, 4].map(() => timed(() => cloneDatabase(urlOf('copies_large')))));

    for (const { seconds, result: clone } of files) {
      expect(seconds).toBeLessThan(5);
      expect(await rowsOf(clone.url, 'select count(*)::int as n from orders')).toEqual([{ n: 0 }]);
      expect(await rowsOf(clone.url, 'select count(*)::int as n from audit.audit_entries')).toEqual([{ n: 0 }]);
      // What the migration tool wrote stays, and the trail refuses a truncate in the copy as in production.
      expect(await rowsOf(clone.url, 'select count(*)::int as n from knex_migrations')).toEqual([{ n: 1 }]);
      await expect(rowsOf(clone.url, 'truncate table audit.audit_entries')).rejects.toThrow('append-only');
      expect(await sizeOf(databaseOf(clone.url))).toBeLessThan(30 * MEGABYTE);
    }

    expect(await sizeOf('copies_large')).toBeGreaterThan(80 * MEGABYTE);

    expect(await rowsOf(urlOf('copies_large'), 'select count(*)::int as n from audit.audit_entries')).toEqual([
      { n: 1 },
    ]);

    expect(told).toHaveLength(1);
    expect(told[0]).toMatch(/^The database "copies_large" holds \d+ MB of rows: copying it took \d+ s of this run/);
    expect(told[0]).toContain('Give the tests a database of their own, migrated and empty');

    await Promise.all(files.map(({ result: clone }) => clone.drop()));
    await end();

    expect(await databasesLike('copies_large_test_')).toEqual([]);
  });

  it('comes with nothing said of a migrated database that holds no row to speak of', async () => {
    const { startRun } = await support();
    const told: string[] = [];

    await migrated('copies_clean');
    await startRun(urlOf('copies_clean'), 2, (line) => told.push(line));

    expect(told).toEqual(['']);
  });
});

describe.runIf(ON_A_SERVER)('the connections of an end-to-end run, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('are what the role has left, shared between the files that run at once, and no pool passes its share', async () => {
    const { startRun, cloneDatabase } = await support();
    const url = await migratedByALimitedRole('copies_limited');

    await startRun(url, 4);

    const files = await Promise.all([1, 2, 3, 4].map(() => cloneDatabase(url)));

    expect(files.map((file) => file.poolSize)).toEqual([2, 2, 2, 2]);

    // Every file fills its pool at the same moment: the server refuses nobody.
    const pools = files.map((file) => new pg.Pool({ connectionString: file.url, max: file.poolSize }));
    const queries = pools.flatMap((pool) => [1, 2, 3, 4, 5].map(() => pool.query('select pg_sleep(0.2)')));

    await expect(Promise.all(queries)).resolves.toHaveLength(20);
    await Promise.all(pools.map((pool) => pool.end()));
  });

  it('refuse, with their numbers, a run whose files at once do not fit, and nothing is left on the server', async () => {
    const { startRun } = await support();
    const url = await migratedByALimitedRole('copies_limited');

    await expect(startRun(url, 8)).rejects.toThrow(
      '8 spec files at once need 16 connections, 2 each at least, and the role leaves 8 (connection limit 9, 1 open): run at most 4 at once (pnpm run test:e2e --maxWorkers=4), raise max_connections, or state what the run may take (TEST_DATABASE_CONNECTIONS).',
    );

    expect(await databasesLike('copies_limited_test_')).toEqual([]);

    await expect(startRun(urlOf('copies_limited'), 5000)).rejects.toThrow(
      /^5000 spec files at once need 10000 connections, 2 each at least, and the server leaves \d+ \(max_connections \d+, \d+ reserved, \d+ open\): run at most \d+ at once/,
    );
  });

  it('are what TEST_DATABASE_CONNECTIONS states instead of what the server says', async () => {
    const { startRun, cloneDatabase } = await support();
    const url = urlOf('copies_stated');

    await migrated('copies_stated');
    process.env['TEST_DATABASE_CONNECTIONS'] = '3';

    await expect(startRun(url, 2)).rejects.toThrow(
      '2 spec files at once need 4 connections, 2 each at least, and TEST_DATABASE_CONNECTIONS allows 3: run at most 1 at once',
    );

    process.env['TEST_DATABASE_CONNECTIONS'] = '9';

    const end = await startRun(url, 2);

    expect((await cloneDatabase(url)).poolSize).toBe(4);

    await end();
    process.env['TEST_DATABASE_CONNECTIONS'] = '500';
    await startRun(url, 2);

    expect((await cloneDatabase(url)).poolSize).toBe(10);
  });
});

async function timed<Result>(work: () => Promise<Result>): Promise<{ seconds: number; result: Result }> {
  const from = Date.now();
  const result = await work();

  return { seconds: (Date.now() - from) / 1000, result };
}
