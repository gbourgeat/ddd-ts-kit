import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { git } from './support/git';
import { mergeWith } from './support/merge-repository';
import { mergedByGit, names, PAYMENTS } from './support/merged-by-git';
import { commitFiles, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

describe('merge-trunk --to-land without a merge, the stop on a table the trunk changed too', () => {
  it('names a sequence that works after that stop: the name is refused until the old migration is deleted', () => {
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

    write(root, 'node_modules/knex/bin/cli.js', "require('node:fs').writeFileSync('tool-ran', '');\n");

    const refused = cli(root, 'knex-generate', '--name', 'add-due-date', '--custom');

    fs.rmSync(path.join(root, 'migrations/20261015101500_add-due-date.js'));

    const generated = cli(root, 'knex-generate', '--name', 'add-due-date', '--custom');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('A migration named add-due-date already exists: 20261015101500_add-due-date.');
    expect(generated.stderr).not.toContain('already exists');
    expect(fs.existsSync(path.join(root, 'tool-ran'))).toBe(true);
  });

  it.each([
    [
      'prisma',
      'prisma/migrations/20261015101500_add_due_date/migration.sql',
      'prisma/migrations/20261016090000_add_currency/migration.sql',
      'delete the folder prisma/migrations/20261015101500_add_due_date/ (`git show HEAD:prisma/migrations/20261015101500_add_due_date/migration.sql` keeps what was written by hand), then `npm run db:generate add_due_date`',
    ],
    [
      'typeorm',
      'migrations/1760000000000-AddDueDate.ts',
      'migrations/1760500000000-AddCurrency.ts',
      'delete migrations/1760000000000-AddDueDate.ts (`git show HEAD:migrations/1760000000000-AddDueDate.ts` keeps what was written by hand), then `npm run db:generate migrations/AddDueDate`',
    ],
  ] as const)('says the same sequence in the words of %s', (orm, mine, theirs, sequence) => {
    const root = mergedByGit(orm, {
      ours: { [mine]: 'ALTER TABLE "invoices" ADD COLUMN "due" date;\n' },
      theirs: { [theirs]: 'ALTER TABLE "invoices" ADD COLUMN "currency" text;\n' },
    });

    expect(mergeTrunk(root, '--to-land').stdout).toContain(sequence);
  });
});

describe('merge-trunk --to-land without a merge, which migrations it renames', () => {
  it('says in a dry run what it would rename, and renames nothing', () => {
    const root = mergedByGit('knex', {
      ours: { 'migrations/20261015101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: PAYMENTS,
    });

    const previewed = mergeTrunk(root, '--to-land', '--dry-run');

    expect(previewed.code).toBe(0);

    expect(previewed.stdout).toContain(
      'migrations:\n  20261015101500_add-invoices would be renamed with a number after the last migration of the trunk',
    );

    expect(previewed.stdout).toContain('next: run the same command without --dry-run to land these migrations');
    expect(previewed.stdout).not.toContain('nothing to merge');
    expect(names(root)).toContain('20261015101500_add-invoices.js');
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('renames only the migrations out of order, in their order, and leaves the one that follows the trunk already', () => {
    const root = mergedByGit('knex', {
      ours: {
        'migrations/20261015101500_add-invoices.js': 'export const up = () => undefined;\n',
        'migrations/20261015111500_add-lines.js': 'export const up = () => undefined;\n',
        'migrations/20261017101500_add-credit-notes.js': 'export const up = () => undefined;\n',
        'migrations/20261018101500_working-add-refunds.js': 'export const up = () => undefined;\n',
      },
      theirs: PAYMENTS,
    });

    const result = mergeTrunk(root, '--to-land');

    expect(names(root)).toEqual([
      '20261016090000_add-payments.js',
      '20261016090001_add-invoices.js',
      '20261016090002_add-lines.js',
      '20261017101500_add-credit-notes.js',
      '20261017101501_add-refunds.js',
    ]);

    expect(result.stdout).not.toContain('add-credit-notes renamed');

    expect(result.stdout).toContain(
      'A database that already applied a migration under its old name (development, preview, shared) would run it again under the new one: reset it, or rename its row in `knex_migrations` (`name`, the file name).',
    );
  });

  it('orders only what is named as a migration: a helper of the trunk that sorts last moves nothing', () => {
    const root = mergedByGit('knex', {
      ours: { 'migrations/20261017101500_add-invoices.js': 'export const up = () => undefined;\n' },
      theirs: { ...PAYMENTS, 'migrations/helpers.js': 'export const timestamps = () => undefined;\n' },
    });

    expect(cli(root, 'verify-merge', '--since', 'main', '--json').json()).toMatchObject({ migrations: [] });
    expect(mergeTrunk(root, '--to-land', '--json').json()).toMatchObject({ status: 'up-to-date', migrations: [] });
    expect(names(root)).toContain('20261017101500_add-invoices.js');
  });

  it('renames the class of a TypeORM migration and its name property, and nothing else that holds the same letters', () => {
    const root = mergedByGit('typeorm', {
      ours: {
        'migrations/1760000000000-AddInvoices.ts': [
          'export class AddInvoices1760000000000Helper {}',
          'export class AddInvoices1760000000000 {',
          "  name = 'AddInvoices1760000000000';",
          "  up = (runner) => runner.query(`INSERT INTO notes VALUES ('AddInvoices1760000000000 ran')`);",
          '}',
          '',
        ].join('\n'),
      },
      theirs: { 'migrations/1760500000000-AddPayments.ts': 'export class AddPayments1760500000000 {}\n' },
    });

    const result = mergeTrunk(root, '--to-land');
    const [, renamed = ''] = names(root);
    const number = renamed.slice(0, 13);

    expect(read(root, `migrations/${renamed}`).split('\n').slice(0, 4)).toEqual([
      'export class AddInvoices1760000000000Helper {}',
      `export class AddInvoices${number} {`,
      `  name = 'AddInvoices${number}';`,
      "  up = (runner) => runner.query(`INSERT INTO notes VALUES ('AddInvoices1760000000000 ran')`);",
    ]);

    expect(result.stdout).toContain('correct its row in `migrations` (`timestamp`, and `name`, the class)');
  });
});

describe('merge-trunk --to-land without a merge, in a project that sits in a folder of the repository', () => {
  it('reads the migrations of the trunk from the project, in a repository whose project sits in a folder', () => {
    const top = trunkRepository({
      'app/ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm: 'knex' } }),
    });

    onBranch(top, 'build/billing');

    commitFiles(
      top,
      {
        'app/migrations/20261015101500_add-due-date.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.date('due'));\n",
      },
      'feat(billing): a due date',
    );

    onBranch(top, 'main');

    commitFiles(
      top,
      {
        'app/migrations/20261016090000_add-currency.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.string('currency'));\n",
      },
      'feat(payments): a currency (#2)',
    );

    onBranch(top, 'build/billing');
    mergeWith(top, {});

    const result = mergeTrunk(path.join(top, 'app'), '--to-land');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('stopped: 20261015101500_add-due-date changes invoices');
    expect(names(top, 'app/migrations')).toContain('20261015101500_add-due-date.js');
  });
});
