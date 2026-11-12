import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { mergedByGit, names, PAYMENTS } from './support/merged-by-git';
import { mergeTrunk } from './support/trunk-history';

describe('merge-trunk --to-land without a merge, a number another migration carries', () => {
  it.each([
    ['knex', (name: string) => `migrations/${name}.js`, 'export const up = () => undefined;\n'],
    ['prisma', (name: string) => `prisma/migrations/${name}/migration.sql`, 'SELECT 1;\n'],
  ] as const)(
    'never renames a %s migration onto one of the branch: it takes the next free number, the order kept',
    (orm, fileOf, held) => {
      const root = mergedByGit(orm, {
        ours: {
          [fileOf('20261001000000_fix')]: `${held}-- the first fix\n`,
          [fileOf('20261016090001_fix')]: `${held}-- the second fix\n`,
          [fileOf('20261017000000_keep')]: held,
        },
        theirs: { [fileOf('20261016090000_add-payments')]: held },
      });

      const result = mergeTrunk(root, '--to-land');
      const folder = orm === 'prisma' ? 'prisma/migrations' : 'migrations';
      const landed = names(root, folder).map((name) => name.replace(/\.js$/, ''));

      expect(result.code, result.stdout).toBe(0);

      expect(landed).toEqual([
        '20261016090000_add-payments',
        '20261016090002_fix',
        '20261016090003_fix',
        '20261017000000_keep',
      ]);

      expect(read(root, fileOf('20261016090002_fix'))).toContain('the first fix');
      expect(read(root, fileOf('20261016090003_fix'))).toContain('the second fix');
    },
  );
});

describe('merge-trunk --to-land and verify-merge, one order for both', () => {
  it.each([
    ['0_init', '00_pre', /^1_pre$/],
    ['20261016090000_add_payments', '202610150000000_long', /^\d{14}_long$/],
  ] as const)(
    'reads Prisma names as strings, %s against %s, in the check and in the rename',
    (theirs, mine, renamed) => {
      const fileOf = (name: string): string => `prisma/migrations/${name}/migration.sql`;

      const root = mergedByGit('prisma', {
        ours: { [fileOf(mine)]: 'SELECT 1;\n' },
        theirs: { [fileOf(theirs)]: 'SELECT 2;\n' },
      });

      const reported = cli(root, 'verify-merge', '--since', 'main', '--json').json();

      mergeTrunk(root, '--to-land');

      expect(reported).toMatchObject({ migrations: [{ kind: 'before-trunk', migration: mine, trunkLast: theirs }] });

      expect(names(root, 'prisma/migrations').filter((name) => name !== theirs)).toEqual([
        expect.stringMatching(renamed),
      ]);

      expect(cli(root, 'verify-merge', '--since', 'main', '--json').json()).toMatchObject({ migrations: [] });
    },
  );

  it('orders every script of a knex folder, a name without separator included', () => {
    const root = mergedByGit('knex', {
      ours: { 'migrations/2026100500.js': 'export const up = () => undefined;\n' },
      theirs: PAYMENTS,
    });

    const reported = cli(root, 'verify-merge', '--since', 'main', '--json').json();

    mergeTrunk(root, '--to-land');

    expect(reported).toMatchObject({ migrations: [{ migration: '2026100500' }] });
    expect(names(root)).toEqual(['20261016090000_add-payments.js', expect.stringMatching(/^\d{14}\.js$/)]);
  });

  it('stops, nothing renamed, on a file of the trunk no number can follow, and on a branch file without number before it', () => {
    const helpers = { ...PAYMENTS, 'migrations/helpers.js': 'export const timestamps = () => undefined;\n' };

    const helper = mergedByGit('knex', {
      ours: { 'migrations/20261015101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: helpers,
    });

    const unnumbered = mergedByGit('knex', {
      ours: { 'migrations/alpha.js': 'export const up = () => undefined;\n' },
      theirs: helpers,
    });

    const stopped = mergeTrunk(helper, '--to-land');

    expect(stopped.code).toBe(1);

    expect(stopped.stdout).toContain(
      'stopped: 20261015101500_add-invoices cannot be given a number that sorts after "helpers", which carries none a migration can follow: rename or move "helpers" by hand (knex loads every script of its folder as a migration), then run the same command again.',
    );

    expect(names(helper)).toContain('20261015101500_add-invoices.js');
    expect(mergeTrunk(unnumbered, '--to-land').stdout).toContain('stopped: alpha cannot be given a number');
  });
});
