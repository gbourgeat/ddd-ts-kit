import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { jsonAt } from './support/json-at';
import { type Files, mergeWith } from './support/merge-repository';
import { commitFiles, onBranch, trunkRepository } from './support/trunk-history';

type Orm = 'drizzle' | 'knex' | 'prisma' | 'typeorm';

const JOURNAL = 'migrations/meta/_journal.json';

/** A project of `orm` whose branch adds `ours` and whose trunk adds `theirs` meanwhile, the branch checked out. */
function branches(
  orm: Orm | 'none',
  { base = {}, ours, theirs }: { base?: Files; ours: Files; theirs: Files },
): string {
  const root = trunkRepository({
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm } }),
    ...base,
  });

  onBranch(root, 'build/billing');
  commitFiles(root, ours, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  commitFiles(root, theirs, 'feat(payments): record a payment (#2)');
  onBranch(root, 'build/billing');

  return root;
}

/** What `verify-merge --since main --json` says of the migrations: kind, migration and last of the trunk, each. */
function migrationsOf(root: string): unknown[] {
  const found = jsonAt(cli(root, 'verify-merge', '--since', 'main', '--json').json(), 'migrations');

  return Array.isArray(found)
    ? found.map((finding) => [jsonAt(finding, 'kind'), jsonAt(finding, 'migration'), jsonAt(finding, 'trunkLast')])
    : [];
}

function journal(...entries: ReadonlyArray<readonly [tag: string, when: number]>): string {
  return JSON.stringify({ entries: entries.map(([tag, when], idx) => ({ idx, when, tag })) });
}

const KNEX = {
  ours: { 'migrations/20261015101500_add-invoices.js': "export const up = (knex) => knex.raw('invoices');\n" },
  theirs: { 'migrations/20261016090000_add-payments.js': "export const up = (knex) => knex.raw('payments');\n" },
};

const DRIZZLE = {
  base: { 'migrations/0000_initial.sql': 'CREATE TABLE "accounts" ();', [JOURNAL]: journal(['0000_initial', 100]) },
  ours: {
    'migrations/0001_add-invoices.sql': 'CREATE TABLE "invoices" ();',
    [JOURNAL]: journal(['0000_initial', 100], ['0001_add-invoices', 200]),
  },
  theirs: {
    'migrations/0001_add-payments.sql': 'CREATE TABLE "payments" ();',
    [JOURNAL]: journal(['0000_initial', 100], ['0001_add-payments', 300]),
  },
};

describe('verify-merge, a migration of the branch that sorts before the last of the trunk', () => {
  it('fails on a knex migration older than the last of the trunk, names both and the command that renames it', () => {
    const root = branches('knex', KNEX);

    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('migrations against main: 1 error(s)');

    expect(result.stdout).toContain(
      'migrations/20261015101500_add-invoices.js  the migration "20261015101500_add-invoices" of this branch sorts before "20261016090000_add-payments", the last migration of main: knex runs it after "20261016090000_add-payments" on a database that already applied that one, and before it on a new database',
    );

    expect(result.stdout).toContain(
      'next: Run `npx ddd-ts-kit merge-trunk --to-land` before the landing: it brings main in and renames the migration with a number after "20261016090000_add-payments", its content kept.',
    );
  });

  it('still fails with --warn, which softens what a merge lost and never the order of the migrations', () => {
    const root = branches('knex', KNEX);

    const result = cli(root, 'verify-merge', '--since', 'main', '--warn');

    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain('warning only');
  });

  it('says that the trunk is merged already once it is, the rename being all that is left', () => {
    const root = branches('knex', KNEX);

    mergeWith(root, {});

    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('main being merged already, it renames the migration');
  });

  it.each([
    [
      'prisma',
      'Prisma',
      {
        ours: { 'prisma/migrations/20261015101500_add_invoices/migration.sql': 'CREATE TABLE "invoices" ();\n' },
        theirs: { 'prisma/migrations/20261016090000_add_payments/migration.sql': 'CREATE TABLE "payments" ();\n' },
      },
      ['20261015101500_add_invoices', '20261016090000_add_payments'],
    ],
    [
      'typeorm',
      'TypeORM',
      {
        ours: { 'migrations/1760000000000-add-invoices.ts': 'export class AddInvoices1760000000000 {}\n' },
        theirs: { 'migrations/1760500000000-add-payments.ts': 'export class AddPayments1760500000000 {}\n' },
      },
      ['1760000000000-add-invoices', '1760500000000-add-payments'],
    ],
  ] as const)('reports it on %s, whose tool runs it late as knex does', (orm, tool, histories, [mine, last]) => {
    const root = branches(orm, histories);

    expect(migrationsOf(root)).toEqual([['before-trunk', mine, last]]);
    expect(cli(root, 'verify-merge', '--since', 'main').stdout).toContain(`${tool} runs it after "${last}"`);
  });

  it('says nothing of a working migration, whose place is decided when the branch lands', () => {
    const root = branches('knex', {
      ours: { 'migrations/20261015101500_working-add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: KNEX.theirs,
    });

    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('says nothing of a migration that sorts after the last of the trunk, nor of a trunk without migration', () => {
    const after = branches('knex', {
      ours: { 'migrations/20261017101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: KNEX.theirs,
    });

    const alone = branches('knex', { ours: KNEX.ours, theirs: { 'README.md': 'Payments.\n' } });

    expect(migrationsOf(after)).toEqual([]);
    expect(migrationsOf(alone)).toEqual([]);
  });

  it('reads no migration without an ORM, without the config of the kit, or for a named commit', () => {
    const none = branches('none', KNEX);
    const bare = branches('knex', { ours: { ...KNEX.ours, 'ddd-ts-kit.config.json': null }, theirs: KNEX.theirs });
    const named = branches('knex', KNEX);

    mergeWith(named, {});

    expect(migrationsOf(none)).toEqual([]);
    expect(migrationsOf(bare)).toEqual([]);
    expect(jsonAt(cli(named, 'verify-merge', 'HEAD', '--json').json(), 'migrations')).toEqual([]);
  });
});

describe('verify-merge, the journal of drizzle-kit against the trunk', () => {
  it('fails on an entry generated before the last of the trunk, which the migrator would skip, and names the merge that replays', () => {
    const root = branches('drizzle', DRIZZLE);

    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(1);
    expect(migrationsOf(root)).toEqual([['before-trunk', '0001_add-invoices', '0001_add-payments']]);

    expect(result.stdout).toContain(
      'migrations/0001_add-invoices.sql  the migration "0001_add-invoices" of this branch was generated before "0001_add-payments", the last migration of main: the migrator of drizzle skips it without a word',
    );

    expect(result.stdout).toContain('next: Run `npx ddd-ts-kit merge-trunk`: it brings main in');
  });

  it('fails on a migration the journal lost in a merge that kept the journal of the trunk, and names the replay', () => {
    const root = branches('drizzle', DRIZZLE);

    mergeWith(root, { [JOURNAL]: DRIZZLE.theirs[JOURNAL] });

    const result = cli(root, 'verify-merge', '--since', 'main');

    expect(result.code).toBe(1);
    expect(migrationsOf(root)).toEqual([['not-in-journal', '0001_add-invoices', undefined]]);
    expect(result.stdout).toContain('is not in migrations/meta/_journal.json: drizzle-kit migrate never applies it');

    expect(result.stdout).toContain(
      'next: Take the journal and the snapshots of the trunk, `git checkout main -- migrations/meta`, then run `npx ddd-ts-kit drizzle-generate --replay --base main`',
    );
  });

  it('fails on a journal merged by hand that keeps the entry of the branch before the one of the trunk', () => {
    const root = branches('drizzle', DRIZZLE);

    mergeWith(root, {
      [JOURNAL]: journal(['0000_initial', 100], ['0001_add-invoices', 200], ['0001_add-payments', 300]),
    });

    expect(migrationsOf(root)).toEqual([['before-trunk', '0001_add-invoices', '0001_add-payments']]);
  });

  it('says nothing of a working entry, of an entry generated after the trunk, of a trunk or a branch without journal', () => {
    const working = branches('drizzle', {
      ...DRIZZLE,
      ours: {
        'migrations/0001_working-add-invoices.sql': 'CREATE TABLE "invoices" ();',
        [JOURNAL]: journal(['0000_initial', 100], ['0001_working-add-invoices', 200]),
      },
    });

    const after = branches('drizzle', {
      ...DRIZZLE,
      ours: { ...DRIZZLE.ours, [JOURNAL]: journal(['0000_initial', 100], ['0001_add-invoices', 400]) },
    });

    const first = branches('drizzle', { ours: { ...DRIZZLE.base, ...DRIZZLE.ours }, theirs: { 'README.md': '.\n' } });
    const none = branches('drizzle', { ours: { 'README.md': 'Billing.\n' }, theirs: { 'NOTES.md': 'Payments.\n' } });

    expect([working, after, first, none].map(migrationsOf)).toEqual([[], [], [], []]);
  });
});
