import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { git } from './support/git';
import { mergedByGit, names, PAYMENTS } from './support/merged-by-git';
import { commitFiles, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

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

    expect(result.stdout).toContain(
      'Generate it again on the trunk: delete migrations/20261015101500_add-due-date.js (`git show HEAD:migrations/20261015101500_add-due-date.js` keeps what was written by hand), then `npm run db:generate add-due-date`, which refuses the name while the old migration is there.',
    );

    expect(result.stdout).toContain('next: no merge is in progress, and the migrations are as they were found.');
    expect(names(root)).toContain('20261015101500_add-due-date.js');
    expect(git(root, 'status', '--porcelain')).toBe('');
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
    expect(names(kept)).toContain('20261015101500_add-invoices.js');
  });

  it('leaves a working migration the trunk itself holds: nothing of the branch is to land', () => {
    const root = trunkRepository({
      'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm: 'knex' } }),
      'migrations/20261015101500_working-add-invoices.js': 'export const up = () => undefined;\n',
    });

    onBranch(root, 'build/billing');
    commitFiles(root, { 'README.md': 'Billing.\n' }, 'docs: billing');

    expect(mergeTrunk(root, '--to-land', '--json').json()).toMatchObject({
      status: 'up-to-date',
      migrations: [],
      next: 'nothing to merge: the branch already holds the trunk',
    });
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
