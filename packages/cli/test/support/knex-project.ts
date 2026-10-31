import fs from 'node:fs';
import path from 'node:path';
import { cli, read, write } from '../helpers';
import { initProject } from './init-project';

const MODULES = path.resolve(__dirname, '../../../../node_modules');

/** Slow: it starts PostgreSQL in process twice per comparison; skipped where the monorepo has no knex installed. */
export const INSTALLED = fs.existsSync(path.join(MODULES, 'knex/bin/cli.js'));

export const COMPILED = 'dist/src/platform/database/schema.js';

export const ORDERS = `await knex.schema.withSchema('ordering').createTable('orders', (table) => {
    table.text('id').primary();
    table.integer('version').notNullable();
  });`;

export const INVOICES = `await knex.schema.withSchema('ordering').createTable('invoices', (table) => {
    table.text('id').primary();
    table.text('tenant_id').notNullable();
    table.index(['tenant_id', 'id'], 'invoices_tenant_idx');
  });`;

/** The compiled form of `createTables`, which `npm run build` leaves in a project. */
export function schemaOf(...definitions: readonly string[]): string {
  return `export const createTables = async (knex) => {
  await knex.schema.createSchemaIfNotExists('ordering');
  ${definitions.join('\n  ')}
};
`;
}

export function knexProject(...definitions: readonly string[]): string {
  const root = initProject('--orm', 'knex', '--package-manager', 'npm');

  fs.symlinkSync(MODULES, path.join(root, 'node_modules'), 'dir');
  write(root, COMPILED, schemaOf(...definitions));

  return root;
}

export function migrations(root: string): string[] {
  return fs
    .readdirSync(path.join(root, 'migrations'))
    .filter((file) => file.endsWith('.js'))
    .sort();
}

export function migrationNamed(root: string, name: string): string {
  const file = migrations(root).find((entry) => entry.endsWith(`_${name}.js`));

  return read(root, `migrations/${file ?? ''}`);
}

export function generate(root: string, name: string, ...flags: readonly string[]): ReturnType<typeof cli> {
  return cli(root, 'knex-generate', '--name', name, ...flags);
}
