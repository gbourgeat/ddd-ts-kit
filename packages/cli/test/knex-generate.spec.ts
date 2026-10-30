import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { knexMigrationText } from '../src/migration/knex-migration-text';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

const MODULES = path.resolve(__dirname, '../../../node_modules');

/** Slow: it starts PostgreSQL in process twice per comparison; skipped where the monorepo has no knex installed. */
const INSTALLED = fs.existsSync(path.join(MODULES, 'knex/bin/cli.js'));

const COMPILED = 'dist/src/platform/database/schema.js';

const ORDERS = `await knex.schema.withSchema('ordering').createTable('orders', (table) => {
    table.text('id').primary();
    table.integer('version').notNullable();
  });`;

const INVOICES = `await knex.schema.withSchema('ordering').createTable('invoices', (table) => {
    table.text('id').primary();
    table.text('tenant_id').notNullable();
    table.index(['tenant_id', 'id'], 'invoices_tenant_idx');
  });`;

/** The compiled form of `createTables`, which `npm run build` leaves in a project. */
function schemaOf(...definitions: readonly string[]): string {
  return `export const createTables = async (knex) => {
  await knex.schema.createSchemaIfNotExists('ordering');
  ${definitions.join('\n  ')}
};
`;
}

function knexProject(...definitions: readonly string[]): string {
  const root = initProject('--orm', 'knex', '--package-manager', 'npm');

  fs.symlinkSync(MODULES, path.join(root, 'node_modules'), 'dir');
  write(root, COMPILED, schemaOf(...definitions));

  return root;
}

function migrations(root: string): string[] {
  return fs
    .readdirSync(path.join(root, 'migrations'))
    .filter((file) => file.endsWith('.js'))
    .sort();
}

function migrationNamed(root: string, name: string): string {
  const file = migrations(root).find((entry) => entry.endsWith(`_${name}.js`));

  return read(root, `migrations/${file ?? ''}`);
}

function generate(root: string, name: string, ...flags: readonly string[]): ReturnType<typeof cli> {
  return cli(root, 'knex-generate', '--name', name, ...flags);
}

describe.runIf(INSTALLED)('db:generate of a Knex project', () => {
  it('writes the first migration from createTables, as SQL that calls nothing of the application', () => {
    const root = knexProject(ORDERS);

    expect(generate(root, 'initial').code).toBe(0);

    const migration = migrationNamed(root, 'initial');

    expect(migration).toContain('create table "ordering"."orders"');
    expect(migration).toContain('create schema if not exists "ordering"');
    expect(migration).not.toContain('import');
    expect(migration).not.toContain('createTables(');
  }, 180_000);

  it('replays the migrations and writes nothing when createTables builds what they build', () => {
    const root = knexProject(ORDERS);

    generate(root, 'initial');

    const again = generate(root, 'again');

    expect(again.code).toBe(0);
    expect(again.stdout).toContain('No schema change');
    expect(migrations(root)).toHaveLength(1);
  }, 180_000);

  it('writes only the table generated after the first migration, with its index', () => {
    const root = knexProject(ORDERS);

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(ORDERS, INVOICES));

    expect(generate(root, 'add-invoices').code).toBe(0);

    const migration = migrationNamed(root, 'add-invoices');

    expect(migration).toContain('create table "ordering"."invoices"');
    expect(migration).toContain('create index "invoices_tenant_idx"');
    expect(migration).not.toContain('"orders"');
    expect(migration).not.toContain('create schema');
  }, 180_000);

  it('adds a column to a table the migrations created, its default and its constraint first', () => {
    const root = knexProject(ORDERS);

    generate(root, 'initial');

    write(
      root,
      COMPILED,
      schemaOf(
        ORDERS.replace(
          "table.integer('version')",
          "table.text('note').notNullable().defaultTo('none');\n    table.integer('version')",
        ),
      ),
    );

    expect(generate(root, 'add-note').code).toBe(0);

    const migration = migrationNamed(root, 'add-note');

    expect(migration).toContain(
      'alter table "ordering"."orders" add column "note" text not null default \'none\'::text',
    );

    expect(migration).not.toContain('create table');
  }, 180_000);

  it('lists what it cannot write in the migration and on the error stream, and leaves the rest of the change written', () => {
    const root = knexProject(ORDERS, INVOICES);

    generate(root, 'initial');

    const changed = ORDERS.replace("table.integer('version').notNullable()", "table.text('version').notNullable()");

    write(
      root,
      COMPILED,
      schemaOf(
        changed,
        `await knex.schema.withSchema('ordering').createTable('payments', (table) => {
    table.text('id').primary();
  });`,
      ),
    );

    const result = generate(root, 'change-orders');
    const migration = migrationNamed(root, 'change-orders');

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('column ordering.orders.version is integer not null in the migrations');
    expect(migration).toContain('TODO(domain): write this change by hand: column ordering.orders.version');
    expect(migration).toContain('TODO(domain): write this change by hand: table ordering.invoices');
    expect(migration).toContain('create table "ordering"."payments"');
  }, 180_000);

  it('reports a column dropped from createTables', () => {
    const root = knexProject(ORDERS);

    generate(root, 'initial');
    write(root, COMPILED, schemaOf(ORDERS.replace("table.integer('version').notNullable();", '')));

    const result = generate(root, 'drop-version');

    expect(result.code).toBe(0);
    expect(migrationNamed(root, 'drop-version')).toContain('column ordering.orders.version is in the migrations');
  }, 180_000);

  it('writes the empty migration of knex with --custom, without comparing', () => {
    const root = knexProject(ORDERS);

    expect(generate(root, 'backfill-notes', '--custom').code).toBe(0);

    const migration = migrationNamed(root, 'backfill-notes');

    expect(migration).toContain('export const up');
    expect(migration).not.toContain('create table');
  }, 180_000);

  it('fails and writes nothing when createTables cannot run on PostgreSQL in process', () => {
    const root = knexProject("await knex.raw('create extension no_such_extension');");

    const result = generate(root, 'initial');

    expect(result.code).toBe(1);
    expect(migrations(root)).toEqual([]);
  }, 180_000);
});

describe('ddd-ts-kit knex-generate refuses', () => {
  it('a migration that calls createTables, which no comparison can trust', () => {
    const root = initProject('--orm', 'knex', '--package-manager', 'npm');

    write(root, 'migrations/00000000000000_initial.js', 'export const up = (knex) => createTables(knex);\n');

    const refused = cli(root, 'knex-generate', '--name', 'add-invoices');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('migrations/00000000000000_initial.js calls `createTables`');
  });

  it('a project whose schema is not built, and says what builds it', () => {
    const root = initProject('--orm', 'knex', '--package-manager', 'npm');

    const refused = cli(root, 'knex-generate', '--name', 'add-invoices');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`${COMPILED} is not built`);
  });

  it('a migration without a name', () => {
    const root = initProject('--orm', 'knex', '--package-manager', 'npm');

    const refused = cli(root, 'knex-generate');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('A migration is named by what it does.');
  });
});

describe('the text of a migration of a Knex project', () => {
  it('holds a statement as a template literal knex runs unchanged', () => {
    const text = knexMigrationText({ statements: ["comment on table t is 'a `b` ${c} \\ d?'"], unwritten: [] });

    expect(text).toContain("`comment on table t is 'a \\`b\\` \\${c} \\\\ d\\\\?'`");
  });

  it('keeps each thing to write by hand on one line', () => {
    const text = knexMigrationText({ statements: [], unwritten: ['column a\n  is b'] });

    expect(text).toContain('// TODO(domain): write this change by hand: column a is b.');
  });
});
