import { afterEach, describe, expect, it } from 'vitest';
import {
  databaseOf,
  databasesLike,
  endRuns,
  hand,
  migrated,
  migratedByALimitedRole,
  rowsOf,
  SERVER,
  support,
  urlOf,
  valueOf,
} from './run-on-a-server';
import { SLOW } from './stacks';

const MEGABYTE = 1024 * 1024;
const ON_A_SERVER = SLOW && SERVER !== '';
const COUNT = 'select count(*)::int from ';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): the support a generated project
 * runs its spec files with on a server, called as the global setup of its end-to-end run and its
 * files call it, on a real PostgreSQL. Here, what a file finds in its database;
 * test-databases-connections.spec.ts holds the connections of a run, and
 * test-databases-left-by-a-run.spec.ts what a run leaves, loses and refuses.
 */
describe.runIf(ON_A_SERVER)('the database of a spec file, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('is the tables of the migrated database, emptied once by the run, in a fraction of the time that one takes to copy', async () => {
    const { openRun, cloneDatabase } = await support();
    const told: string[] = [];

    await migrated('copies_large', { megabytes: 80 });

    const run = hand(await openRun(urlOf('copies_large'), 4, (line) => told.push(line)));
    const files = await Promise.all([1, 2, 3, 4].map(() => timed(() => cloneDatabase(urlOf('copies_large')))));

    for (const { seconds, result: clone } of files) {
      expect(seconds).toBeLessThan(5);
      expect(await valueOf(clone.url, COUNT + 'orders')).toBe(0);
      expect(await valueOf(clone.url, COUNT + 'order_lines')).toBe(0);
      // A view that held a result of the rows shows none of them.
      expect(await valueOf(clone.url, 'select orders from orders_counted')).toBe(0);

      expect(await valueOf(clone.url, `select pg_database_size('${databaseOf(clone.url)}')::float8`)).toBeLessThan(
        30 * MEGABYTE,
      );
    }

    expect(await valueOf(urlOf('copies_large'), COUNT + 'orders')).toBe(80 * 3600);

    expect(told.join('')).toMatch(
      /^The run emptied 3 table\(s\) of its copy of "copies_large" that held rows \((?:public\.(?:orders|order_lines|countries)(?:, )?){3}\): a spec stores the rows it needs, and a table whose rows the application reads is listed in KEPT_TABLES of test\/support\/test-database-kept\.ts\.\nThose rows take \d+ MB: copying them took \d+ s of this run\. Give the tests a database of their own, migrated and empty/,
    );

    await Promise.all(files.map(({ result: clone }) => clone.drop()));
    await run.end();

    expect(await databasesLike('copies_large_test_')).toEqual([]);
  });

  it('keeps what the migration tool wrote and the audit trail, which no trigger is touched for, and says nothing of a database without rows', async () => {
    const { openRun, cloneDatabase } = await support();
    const told: string[] = [];

    await migrated('copies_clean');
    await rowsOf(urlOf('copies_clean'), "insert into audit.audit_entries (entry) values ('kept')");
    await rowsOf(urlOf('copies_clean'), 'truncate table countries');
    hand(await openRun(urlOf('copies_clean'), 2, (line) => told.push(line)));

    const clone = await cloneDatabase(urlOf('copies_clean'));

    expect(told).toEqual(['']);
    expect(await valueOf(clone.url, COUNT + 'knex_migrations')).toBe(1);
    expect(await valueOf(clone.url, COUNT + 'audit.audit_entries')).toBe(1);
    await expect(rowsOf(clone.url, 'truncate table audit.audit_entries')).rejects.toThrow('append-only');
  });
});

describe.runIf(ON_A_SERVER)('the tables a project keeps, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('keep their rows when the project lists them, by name or by schema', async () => {
    const kept = ['public.knex_migrations', 'public.countries', 'audit.*'];
    const { openRun, cloneDatabase } = await support({ kept });
    const told: string[] = [];

    await migrated('copies_kept', { megabytes: 1 });
    hand(await openRun(urlOf('copies_kept'), 1, (line) => told.push(line)));

    const clone = await cloneDatabase(urlOf('copies_kept'));

    expect(await valueOf(clone.url, COUNT + 'countries')).toBe(2);
    expect(await valueOf(clone.url, COUNT + 'orders')).toBe(0);

    expect(told.join('')).toMatch(
      /^The run emptied 2 table\(s\) of its copy of "copies_kept" that held rows \(public\.order/,
    );
  });

  it('are refused with both names when one references a table the run empties, which no cascade then empties for it', async () => {
    const { openRun } = await support({ kept: ['public.knex_migrations', 'public.order_lines', 'audit.*'] });

    await migrated('copies_kept', { megabytes: 1 });

    await expect(openRun(urlOf('copies_kept'), 1)).rejects.toThrow(
      'The table public.order_lines keeps its rows and references public.orders, which the run empties: keep public.orders too, in KEPT_TABLES of test/support/test-database-kept.ts.',
    );

    expect(await databasesLike('copies_kept_test_')).toEqual([]);
  });

  it('are left as they are, and named, when another role owns them: the trail of a project whose role only appends to it', async () => {
    const { openRun, cloneDatabase } = await support({ kept: ['public.knex_migrations'] });
    const url = await migratedByALimitedRole('copies_owned', 20);
    const told: string[] = [];

    hand(await openRun(url, 1, (line) => told.push(line)));

    const clone = await cloneDatabase(url);

    expect(told.join('')).toContain(
      'It left 1 table(s) with their rows, which another role owns (audit.audit_entries).\n',
    );

    expect(await valueOf(clone.url, COUNT + 'audit.audit_entries')).toBe(1);
    expect(await valueOf(clone.url, COUNT + 'orders')).toBe(0);
  });

  it('are the trail too as the project is generated: a role that owns no table of it runs as any other', async () => {
    const { openRun } = await support();
    const told: string[] = [];

    await openRun(await migratedByALimitedRole('copies_owned', 20), 1, (line) => told.push(line));

    expect(told.join('')).not.toContain('another role');
  });
});

describe.runIf(ON_A_SERVER)(
  'a database asked for outside an end-to-end run, on a real PostgreSQL',
  { timeout: 120_000 },
  () => {
    afterEach(endRuns);

    it('is copied and emptied by the call itself, with no global setup, in a project without an HTTP stack on TypeORM', async () => {
      const { cloneDatabase } = await support({ flags: ['--http', 'none', '--orm', 'typeorm', '--audit', 'on'] });

      await migrated('copies_alone', { megabytes: 1 });

      const [first, second] = await Promise.all([1, 2].map(() => cloneDatabase(urlOf('copies_alone'))));

      expect(first?.url).not.toBe(second?.url);
      expect(await valueOf(first?.url ?? '', COUNT + 'orders')).toBe(0);
      expect(first?.poolSize).toBe(10);
      expect(await databasesLike('copies_alone_test_')).toHaveLength(2);

      await first?.drop();
      await second?.drop();

      expect(await databasesLike('copies_alone_test_')).toEqual([]);
    });
  },
);

async function timed<Result>(work: () => Promise<Result>): Promise<{ seconds: number; result: Result }> {
  const from = Date.now();
  const result = await work();

  return { seconds: (Date.now() - from) / 1000, result };
}
