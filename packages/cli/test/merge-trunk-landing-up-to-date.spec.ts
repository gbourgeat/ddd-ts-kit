import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub';
import { git } from './support/git';
import { type Files, mergeWith } from './support/merge-repository';
import { commitFiles, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

const JOURNAL = 'migrations/meta/_journal.json';
const REPLAY_TIMEOUT = 30_000;

/** A project of `orm` whose branch added `ours`, whose trunk added `theirs`, and which merged the trunk with git alone. */
function mergedByGit(orm: 'knex' | 'prisma' | 'typeorm', { ours, theirs }: { ours: Files; theirs: Files }): string {
  const root = trunkRepository({ 'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm } }) });

  onBranch(root, 'build/billing');
  commitFiles(root, ours, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  commitFiles(root, theirs, 'feat(payments): record a payment (#2)');
  onBranch(root, 'build/billing');
  mergeWith(root, {});

  return root;
}

function names(root: string, folder = 'migrations'): string[] {
  return fs
    .readdirSync(path.join(root, folder))
    .filter((entry) => entry !== 'meta')
    .sort();
}

const PAYMENTS = {
  'migrations/20261016090000_add-payments.js': "export const up = (knex) => knex.schema.createTable('payments');\n",
};

describe('merge-trunk --to-land on a branch that already holds the trunk', () => {
  it("renames a knex migration that sorts before the trunk's last, leaves it to commit, and verify-merge then passes", () => {
    const root = mergedByGit('knex', {
      ours: {
        'migrations/20261015101500_add-invoices.js':
          "export const up = (knex) => knex.schema.createTable('invoices');\n",
      },
      theirs: PAYMENTS,
    });

    expect(cli(root, 'verify-merge', '--since', 'main').code).toBe(1);

    const result = mergeTrunk(root, '--to-land');
    const [payments = '', invoices = ''] = names(root);

    expect(result.code, result.stdout).toBe(0);
    expect(payments).toBe('20261016090000_add-payments.js');
    expect(invoices).toMatch(/^\d{14}_add-invoices\.js$/);

    expect(result.stdout).toContain(
      `migrations:\n  20261015101500_add-invoices renamed ${invoices.slice(0, -3)}, after the last migration of the trunk`,
    );

    expect(result.stdout).toContain('next: commit the migrations as they are now');
    expect(git(root, 'status', '--porcelain')).toContain(invoices);
    expect(cli(root, 'verify-merge', '--since', 'main').code).toBe(0);
  });

  it('gives a working migration its real name too, although it broke no order', () => {
    const root = mergedByGit('knex', {
      ours: { 'migrations/20261017101500_working-add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: PAYMENTS,
    });

    expect(mergeTrunk(root, '--to-land', '--json').json()).toMatchObject({ status: 'up-to-date' });
    expect(names(root)[1]).toMatch(/^\d{14}_add-invoices\.js$/);
  });

  it('stops when the migration changes a table a later migration of the trunk changes too: their order is a decision', () => {
    const root = mergedByGit('knex', {
      ours: {
        'migrations/20261015101500_add-due-date.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.date('due'));\n",
      },
      theirs: {
        'migrations/20261016090000_add-currency.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.string('currency'));\n",
      },
    });

    const result = mergeTrunk(root, '--to-land');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('stopped: 20261015101500_add-due-date changes invoices');
    expect(result.stdout).toContain('Regenerate it on the trunk: `npm run db:generate add-due-date`');
    expect(result.stdout).toContain('next: no merge is in progress.');
    expect(names(root)).toContain('20261015101500_add-due-date.js');
  });

  it('changes nothing when the migrations already follow the trunk, without --to-land, in a dry run, or without the kit', () => {
    const histories = {
      ours: { 'migrations/20261015101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: PAYMENTS,
    };

    const after = mergedByGit('knex', {
      ours: { 'migrations/20261017101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: PAYMENTS,
    });

    const bare = mergedByGit('knex', { ours: { ...histories.ours, 'ddd-ts-kit.config.json': null }, theirs: PAYMENTS });
    const kept = mergedByGit('knex', histories);

    expect(mergeTrunk(after, '--to-land', '--json').json()).toMatchObject({ status: 'up-to-date', migrations: [] });
    expect(mergeTrunk(bare, '--to-land', '--json').json()).toMatchObject({ status: 'up-to-date', migrations: [] });
    expect(mergeTrunk(kept, '--json').json()).toMatchObject({ status: 'up-to-date', migrations: [] });
    expect(mergeTrunk(kept, '--to-land', '--dry-run', '--json').json()).toMatchObject({ migrations: [] });
    expect(names(kept)).toContain('20261015101500_add-invoices.js');
  });

  it('lands nothing on a storage of its own, which has no migration of the kit', () => {
    const root = trunkRepository({
      'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm: 'custom' } }),
      'migrations/20261015101500_working-add-invoices.js': 'export const up = () => undefined;\n',
    });

    onBranch(root, 'build/billing');
    commitFiles(root, { 'README.md': 'Billing.\n' }, 'docs: billing');

    expect(mergeTrunk(root, '--to-land', '--json').json()).toMatchObject({ status: 'up-to-date', migrations: [] });
  });
});

describe('merge-trunk --to-land on a drizzle branch that already holds the trunk', () => {
  it(
    'replays the migration a git merge left out of the journal of the trunk, under its real name',
    () => {
      const root = trunkRepository({
        'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
        'schema/accounts.json': '{"name":"accounts"}',
      });

      const generate = (name: string): number => cli(root, 'drizzle-generate', '--name', name).code;

      write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);
      generate('initial');
      commitFiles(root, {}, 'chore: initial migration');
      onBranch(root, 'build/billing');
      write(root, 'schema/invoices.json', '{"name":"invoices"}');
      generate('working-add-invoices');
      commitFiles(root, {}, 'feat(billing): issue an invoice');
      onBranch(root, 'main');
      write(root, 'schema/payments.json', '{"name":"payments"}');
      generate('add-payments');
      commitFiles(root, {}, 'feat(payments): record a payment (#2)');

      const theirs = read(root, JOURNAL);

      onBranch(root, 'build/billing');
      mergeWith(root, { [JOURNAL]: theirs });

      const result = mergeTrunk(root, '--to-land', '--json');

      expect(result.code, result.stdout).toBe(0);
      expect(result.json()).toMatchObject({ status: 'up-to-date' });

      expect(
        JSON.parse(read(root, JOURNAL)).entries.map((entry: { tag: string }) => entry.tag.replace(/^\d+_/, '')),
      ).toEqual(['initial', 'add-payments', 'add-invoices']);

      expect(cli(root, 'verify-merge', '--since', 'main', '--json').json()).toMatchObject({ migrations: [] });
    },
    REPLAY_TIMEOUT,
  );
});
