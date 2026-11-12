import { afterEach, describe, expect, it } from 'vitest';
import {
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

const ON_A_SERVER = SLOW && SERVER !== '';
const COUNT = 'select count(*)::int from ';
const KEPT = 'KEPT_TABLES of test/support/test-database-kept.ts';
const GENERATED = ['public.knex_migrations', 'public.knex_migrations_lock', 'audit.*'];

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): the tables the run of a
 * generated project does not empty on a server, as the project lists them in
 * test/support/test-database-kept.ts, on a real PostgreSQL.
 */
describe.runIf(ON_A_SERVER)('the tables a project keeps, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('keep their rows when the project lists them, by name or by schema', async () => {
    const { openRun, cloneDatabase } = await support({ kept: [...GENERATED, 'public.countries'] });
    const told: string[] = [];

    await migrated('copies_kept', { megabytes: 1 });
    hand(await openRun(urlOf('copies_kept'), 1, (line) => told.push(line)));

    const clone = await cloneDatabase(urlOf('copies_kept'));

    expect(await valueOf(clone.url, COUNT + 'countries')).toBe(2);
    expect(await valueOf(clone.url, COUNT + 'orders')).toBe(0);

    // A table the generated list names and the project does not hold yet is not a word: here the lock of the migration tool.
    expect(told).toEqual([
      `The run emptied 2 table(s) of its copy of "copies_kept" that held rows (public.order_lines, public.orders): a spec stores the rows it needs, and a table whose rows the application reads is listed in ${KEPT}.\n`,
    ]);
  });

  it('are refused with both names when one references a table the run empties, which no cascade then empties for it', async () => {
    const { openRun } = await support({ kept: ['public.knex_migrations', 'public.order_lines', 'audit.*'] });

    await migrated('copies_kept', { megabytes: 1 });

    await expect(openRun(urlOf('copies_kept'), 1)).rejects.toThrow(
      `The table public.order_lines keeps its rows and references public.orders, which the run empties: keep public.orders too, in ${KEPT}.`,
    );

    expect(await databasesLike('copies_kept_test_')).toEqual([]);
  });

  it('are left as they are, and named, when another role owns them or their schema is closed to the role of the run', async () => {
    const { openRun, cloneDatabase } = await support({ kept: ['public.knex_migrations'] });
    const url = await migratedByALimitedRole('copies_owned', 20);
    const told: string[] = [];

    // A table the role owns in a schema it may not use: the server would refuse to empty it.
    await rowsOf(urlOf('copies_owned'), 'create schema vault');
    await rowsOf(urlOf('copies_owned'), 'create table vault.secrets (id int)');
    await rowsOf(urlOf('copies_owned'), 'alter table vault.secrets owner to copies_owned');
    hand(await openRun(url, 1, (line) => told.push(line)));

    const clone = await cloneDatabase(url);

    expect(told.join('')).toContain(
      'It left 2 table(s) with their rows, which another role owns or whose schema the role of the run may not use (audit.audit_entries, vault.secrets).\n',
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

describe.runIf(ON_A_SERVER)('a name of the list that keeps nothing, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('is said, one line a name: a misspelling, another case than the server stores, a view', async () => {
    const unmatched = ['public.countrys', 'public.Countries', 'public.orders_counted', 'reference.*'];
    const { openRun, cloneDatabase } = await support({ kept: [...GENERATED, ...unmatched, 'public.Regions'] });
    const told: string[] = [];

    await migrated('copies_named');
    // Created between quotes, the table is stored with its capital, and listed so.
    await rowsOf(urlOf('copies_named'), `create table "Regions" (code text); insert into "Regions" values ('EU')`);
    hand(await openRun(urlOf('copies_named'), 1, (line) => told.push(line)));

    expect(told.filter((line) => line.startsWith('KEPT_TABLES'))).toEqual(
      unmatched.map(
        (name) =>
          `${KEPT} lists ${name}, which is no table of "copies_named" and keeps nothing: a name is written as the server stores it, in lower case unless the table was created between quotes, and a view holds no rows of its own.\n`,
      ),
    );

    const clone = await cloneDatabase(urlOf('copies_named'));

    expect(await valueOf(clone.url, COUNT + '"Regions"')).toBe(1);
    expect(await valueOf(clone.url, COUNT + 'countries')).toBe(0);
  });

  it.each([['*'], ['public'], ['*.*'], ['"public"."countries"'], ['a.b.c'], ['']])(
    'is refused with the shapes a name takes when it is "%s"',
    async (shapeless) => {
      const { openRun } = await support({ kept: ['public.knex_migrations', shapeless] });

      await migrated('copies_named');

      await expect(openRun(urlOf('copies_named'), 1)).rejects.toThrow(
        `${KEPT} holds "${shapeless}": a name is <schema>.<table>, or <schema>.* for every table of a schema, written as the server stores it and without quotes (a table created as "Countries" is public.Countries, one created as countries or Countries without quotes is public.countries).`,
      );

      expect(await databasesLike('copies_named_test_')).toEqual([]);
    },
  );

  it('names up to 20 of the tables it emptied, then counts the others', async () => {
    const { openRun } = await support();
    const told: string[] = [];

    await migrated('copies_named');

    for (let table = 10; table < 32; table++) {
      await rowsOf(urlOf('copies_named'), `create table held_${table} as select 1 as id`);
    }

    await openRun(urlOf('copies_named'), 1, (line) => told.push(line));

    expect(told[0]).toContain(
      `emptied 23 table(s) of its copy of "copies_named" that held rows (public.countries, ${Array.from({ length: 19 }, (_, index) => `public.held_${index + 10}`).join(', ')} and 3 more): `,
    );
  });
});

describe.runIf(ON_A_SERVER)('a kept table that shares its rows, on a real PostgreSQL', { timeout: 120_000 }, () => {
  afterEach(endRuns);

  it('keeps them when it inherits from a table the run empties, which is emptied alone', async () => {
    const { openRun, cloneDatabase } = await support({ kept: [...GENERATED, 'public.archived_orders'] });

    await migrated('copies_shared', { megabytes: 1 });
    await rowsOf(urlOf('copies_shared'), 'create table archived_orders () inherits (orders)');
    await rowsOf(urlOf('copies_shared'), "insert into archived_orders (note) values ('kept')");
    hand(await openRun(urlOf('copies_shared'), 1, () => undefined));

    const clone = await cloneDatabase(urlOf('copies_shared'));

    expect(await valueOf(clone.url, COUNT + 'only orders')).toBe(0);
    expect(await valueOf(clone.url, COUNT + 'archived_orders')).toBe(1);
  });

  it('is refused with the table it is a partition of, which the run empties with its partitions', async () => {
    const { openRun } = await support({ kept: [...GENERATED, 'public.events_2026'] });

    await partitioned('copies_shared');

    await expect(openRun(urlOf('copies_shared'), 1)).rejects.toThrow(
      `The table public.events_2026 is a partition of public.events, which the run empties, and a partition is emptied with its table: keep public.events in ${KEPT}.`,
    );
  });

  it('is refused with the table the run empties when it references one of its partitions', async () => {
    const { openRun, cloneDatabase } = await support({ kept: [...GENERATED, 'public.event_notes'] });

    await partitioned('copies_shared');

    await expect(openRun(urlOf('copies_shared'), 1)).rejects.toThrow(
      `The table public.event_notes keeps its rows and references public.events, which the run empties: keep public.events too, in ${KEPT}.`,
    );

    // Kept with its notes, the partitioned table keeps the rows of its partitions.
    const both = await support({ kept: [...GENERATED, 'public.event_notes', 'public.events'] });

    hand(await both.openRun(urlOf('copies_shared'), 1, () => undefined));

    expect(await valueOf((await cloneDatabase(urlOf('copies_shared'))).url, COUNT + 'events')).toBe(1);
  });
});

/** A migrated database with a table partitioned by year, a row in its partition, and a table that references that partition. */
async function partitioned(database: string): Promise<void> {
  await migrated(database);

  for (const statement of [
    'create table events (id int, at date, primary key (id, at)) partition by range (at)',
    `create table events_2026 partition of events for values from ('2026-01-01') to ('2027-01-01')`,
    `insert into events values (1, '2026-11-12')`,
    'create table event_notes (event_id int, at date, foreign key (event_id, at) references events_2026 (id, at))',
    `insert into event_notes values (1, '2026-11-12')`,
  ]) {
    await rowsOf(urlOf(database), statement);
  }
}
