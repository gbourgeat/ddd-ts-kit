import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub.js';
import { git } from './support/git.js';
import { commitFiles, type Files, mergeTrunk, onBranch, trunkRepository, workerFile } from './support/trunk-history.js';

/** Generating again waits for the next second between two migrations, as drizzle-kit numbers them to the second. */
const REPLAY_TIMEOUT = 30_000;

function generate(root: string, name: string): void {
  const result = cli(root, 'drizzle-generate', '--name', name);

  expect(result.code, result.stderr).toBe(0);
}

/** A drizzle project whose drizzle-kit is the stand-in: the branch adds the invoices, the trunk the payments meanwhile. */
function drizzleBranches(): string {
  const root = trunkRepository({
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
    'schema/accounts.json': '{"name":"accounts"}',
  });

  write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);
  generate(root, 'initial');
  commitFiles(root, {}, 'chore: initial migration');
  onBranch(root, 'build/billing');
  write(root, 'schema/invoices.json', '{"name":"invoices"}');
  generate(root, 'working-add-invoices');
  commitFiles(root, {}, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  write(root, 'schema/payments.json', '{"name":"payments"}');
  generate(root, 'add-payments');
  commitFiles(root, {}, 'feat(payments): record a payment (#2)');
  onBranch(root, 'build/billing');

  return root;
}

function names(root: string, folder = 'migrations'): string[] {
  return fs
    .readdirSync(path.join(root, folder))
    .filter((entry) => entry !== 'meta')
    .map((entry) => entry.replace(/^\d+[_-]/, ''))
    .sort();
}

/** A project of `orm` whose branch adds `ours` migrations and whose trunk adds `theirs` meanwhile. */
function migrationBranches(
  orm: 'knex' | 'prisma' | 'typeorm',
  { ours, theirs }: { ours: Files; theirs: Files },
): string {
  const root = trunkRepository({ 'ddd-ts-kit.config.json': JSON.stringify({ contexts: {}, stack: { orm } }) });

  onBranch(root, 'build/billing');
  commitFiles(root, ours, 'feat(billing): issue an invoice');
  onBranch(root, 'main');
  commitFiles(root, theirs, 'feat(payments): record a payment (#2)');
  onBranch(root, 'build/billing');

  return root;
}

describe('merge-trunk: migrations', () => {
  it(
    'generates the working migration of a worker again on top of the trunk, and keeps it a working one until it lands',
    () => {
      const root = drizzleBranches();

      workerFile(root, { base: 'main' });

      const result = mergeTrunk(root, '--json');

      expect(result.code, result.stdout).toBe(0);

      expect(result.json()).toMatchObject({
        status: 'committed',
        automatic: [{ file: 'migrations/meta/_journal.json', kind: 'drizzle-meta' }],
        migrations: expect.arrayContaining([
          expect.stringMatching(/^Generated \d+_working-add-invoices in place of \d+_working-add-invoices\.$/),
        ]),
      });

      expect(names(root)).toEqual(['add-payments.sql', 'initial.sql', 'working-add-invoices.sql']);
      expect(git(root, 'status', '--porcelain').trim()).toBe('');
    },
    REPLAY_TIMEOUT,
  );

  it(
    'gives the migration its real name with --to-land, in the worktree of a worker too',
    () => {
      const root = drizzleBranches();

      workerFile(root, { base: 'main' });

      const result = mergeTrunk(root, '--to-land', '--json');

      expect(result.json()).toMatchObject({
        status: 'committed',
        next: '`npm run verify` in this worktree, push, then squash-merge the pull request',
      });

      expect(names(root)).toEqual(['add-invoices.sql', 'add-payments.sql', 'initial.sql']);

      expect(
        JSON.parse(read(root, 'migrations/meta/_journal.json')).entries.map((entry: { tag: string }) =>
          entry.tag.replace(/^\d+_/, ''),
        ),
      ).toEqual(['initial', 'add-payments', 'add-invoices']);
    },
    REPLAY_TIMEOUT,
  );
});

describe('merge-trunk: knex, Prisma and TypeORM migrations on --to-land', () => {
  it("renames a knex migration after the trunk's last on --to-land, its content kept, and leaves it alone otherwise", () => {
    const migrations = {
      ours: {
        'migrations/20261015101500_working-add-invoices.js':
          "export const up = (knex) => knex.schema.createTable('invoices', () => {});\n",
      },
      theirs: {
        'migrations/20261016090000_add-payments.js':
          "export const up = (knex) => knex.schema.createTable('payments', () => {});\n",
      },
    };

    const kept = migrationBranches('knex', migrations);

    expect(mergeTrunk(kept, '--json').json()).toMatchObject({ status: 'committed', migrations: [] });
    expect(names(kept)).toEqual(['add-payments.js', 'working-add-invoices.js']);

    const landed = migrationBranches('knex', migrations);
    const result = mergeTrunk(landed, '--to-land', '--json');

    const renamed =
      fs.readdirSync(path.join(landed, 'migrations')).find((entry) => entry.endsWith('_add-invoices.js')) ?? '';

    expect(result.json()).toMatchObject({
      status: 'committed',
      migrations: [
        `20261015101500_working-add-invoices renamed ${renamed.slice(0, -3)}, after the last migration of the trunk`,
      ],
    });

    expect(renamed > '20261016090000').toBe(true);

    expect(read(landed, `migrations/${renamed}`)).toBe(
      migrations.ours['migrations/20261015101500_working-add-invoices.js'],
    );
  });

  it('renames the folder of a Prisma migration on --to-land', () => {
    const root = migrationBranches('prisma', {
      ours: { 'prisma/migrations/20261015101500_working_add_invoices/migration.sql': 'CREATE TABLE "invoices" ();\n' },
      theirs: { 'prisma/migrations/20261016090000_add_payments/migration.sql': 'CREATE TABLE "payments" ();\n' },
    });

    expect(mergeTrunk(root, '--to-land').code).toBe(0);
    expect(names(root, 'prisma/migrations')).toEqual(['add_invoices', 'add_payments']);
  });

  it('renames a TypeORM migration, its class and its name, on --to-land', () => {
    const migration = (name: string, number: string): string =>
      `export class ${name}${number} implements MigrationInterface {\n  name = '${name}${number}';\n}\n`;

    const root = migrationBranches('typeorm', {
      ours: { 'migrations/1760000000000-working-add-invoices.ts': migration('WorkingAddInvoices', '1760000000000') },
      theirs: { 'migrations/1760500000000-add-payments.ts': migration('AddPayments', '1760500000000') },
    });

    expect(mergeTrunk(root, '--to-land').code).toBe(0);

    const renamed =
      fs.readdirSync(path.join(root, 'migrations')).find((entry) => entry.endsWith('-add-invoices.ts')) ?? '';

    const number = renamed.split('-')[0] ?? '';

    expect(Number(number)).toBeGreaterThan(1760500000000);
    expect(read(root, `migrations/${renamed}`)).toBe(migration('AddInvoices', number));
  });

  it("stops when the trunk gained a migration on a table the branch's migration changes too: their order is a decision", () => {
    const root = migrationBranches('knex', {
      ours: {
        'migrations/20261015101500_working-add-due-date.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.date('due'));\n",
      },
      theirs: {
        'migrations/20261016090000_add-currency.js':
          "export const up = (knex) => knex.schema.alterTable('invoices', (table) => table.string('currency'));\n",
      },
    });

    const result = mergeTrunk(root, '--to-land');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      'stopped: 20261015101500_working-add-due-date changes invoices, which a migration the trunk gained since the base changes too (20261016090000_add-currency)',
    );

    expect(result.stdout).toContain('Regenerate it on the trunk: `npm run db:generate add-due-date`');
    expect(fs.existsSync(path.join(root, '.git', 'MERGE_HEAD'))).toBe(true);
  });
});
