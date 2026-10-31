import { describe, expect, it } from 'vitest';
import { warnDroppedContextTables } from '../src/migration';
import { cli, exists, read, tempDir, write } from './helpers';
import { commitAll } from './support/commit-all';
import { ok, orderingProject } from './support/ordering-project';

const BIN = 'node_modules/drizzle-kit/bin.cjs';

/** A project whose drizzle-kit is a stand-in that records that it ran. */
function projectWithDrizzleKit(): string {
  const root = tempDir('drizzle-generate');

  write(root, BIN, "require('node:fs').writeFileSync('arguments.json', '[]');\n");

  return root;
}

const warned = (root: string, tool: 'drizzle-kit' | 'typeorm'): string => {
  const lines: string[] = [];

  warnDroppedContextTables(root, { out: () => undefined, err: (text) => lines.push(text) }, tool);

  return lines.join('\n');
};

describe('ddd-ts-kit drizzle-generate, before a migration that drops the tables of a context', () => {
  const INDEX = 'src/platform/database/schema.ts';
  const EXPORT = "export * from '@/contexts/ordering/infrastructure/persistence/ordering.schema';\n";
  const PERSISTENCE = 'src/contexts/ordering/infrastructure/persistence';
  const TABLES = `${PERSISTENCE}/ordering.schema.ts`;
  const ORDERS = "export const orders = orderingSchema.table('orders', { id: text('id') });\n";

  /** A project with the context ordering, whose last migration created `ordering.orders`; drizzle-kit records that it ran. */
  function projectWithOrders(index: string): string {
    const root = projectWithDrizzleKit();

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: { ordering: { classification: 'core' } } }));
    write(root, INDEX, index);
    write(root, TABLES, ORDERS);

    write(
      root,
      'migrations/meta/_journal.json',
      JSON.stringify({ entries: [{ idx: 0, tag: '20260101120000_orders' }] }),
    );

    write(
      root,
      'migrations/meta/20260101120000_snapshot.json',
      JSON.stringify({ tables: { 'ordering.orders': { name: 'orders', schema: 'ordering' }, 'messaging.outbox': {} } }),
    );

    return root;
  }

  it('says so first, and goes on: the tables a line lost from the schema index would take their rows with them', () => {
    const root = projectWithOrders('// ddd-ts-kit:schemas\n// /ddd-ts-kit:schemas\n');
    const result = cli(root, 'drizzle-generate', '--name', 'next');

    expect(result.code).toBe(0);
    expect(exists(root, 'arguments.json')).toBe(true);
    expect(result.stderr).toContain('drops the tables of the context ordering (ordering.orders)');
    expect(result.stderr).toContain(`${INDEX} no longer names them`);
    expect(result.stderr).toContain('`npx ddd-ts-kit init --force`');
  });

  it('does not take a comment for an export', () => {
    const root = projectWithOrders(`// ${EXPORT}`);

    expect(cli(root, 'drizzle-generate', '--name', 'next').stderr).toContain(
      'drops the tables of the context ordering',
    );
  });

  it('reads the tables where the context exports them, under whatever file name', () => {
    const root = projectWithOrders("export * from '@/contexts/ordering/infrastructure/persistence/orders.tables';\n");

    write(root, TABLES, '');
    write(root, `${PERSISTENCE}/orders.tables.ts`, ORDERS);

    expect(cli(root, 'drizzle-generate', '--name', 'next').stderr).not.toContain('Warning');
  });

  it('says nothing of a table the context no longer declares: that one goes on purpose', () => {
    const root = projectWithOrders('// ddd-ts-kit:schemas\n// /ddd-ts-kit:schemas\n');

    write(root, TABLES, '');

    expect(cli(root, 'drizzle-generate', '--name', 'next').stderr).not.toContain('Warning');
  });

  it('says nothing while the index names the tables, or when no migration created them', () => {
    expect(cli(projectWithOrders(EXPORT), 'drizzle-generate', '--name', 'next').stderr).not.toContain('Warning');

    const fresh = projectWithOrders('');

    write(fresh, 'migrations/meta/_journal.json', '{ not json');
    expect(cli(fresh, 'drizzle-generate', '--name', 'next').stderr).not.toContain('Warning');
  });
});

describe('ddd-ts-kit typeorm-generate, before a migration that drops the tables of a context', () => {
  const INDEX = 'src/platform/database/schema.ts';
  const SOURCE = '@/contexts/ordering/infrastructure/persistence/ordering.schema';
  const TABLES = 'src/contexts/ordering/infrastructure/persistence/ordering.schema.ts';

  /** A project on TypeORM with the context ordering, whose migration created `ordering.orders`. */
  function projectWithEntities(index: string): string {
    const root = tempDir('typeorm-generate');

    write(
      root,
      'ddd-ts-kit.config.json',
      JSON.stringify({ contexts: { ordering: { classification: 'core' } }, stack: { orm: 'typeorm' } }),
    );

    write(root, INDEX, index);

    write(
      root,
      TABLES,
      "export const orders = new EntitySchema({ name: 'Order', tableName: 'orders', columns: {} });\n",
    );

    write(
      root,
      'migrations/1700000000000-init.ts',
      'await queryRunner.query(`CREATE TABLE "ordering"."orders" ("id" text)`);\n',
    );

    return root;
  }

  const said = (root: string): string => warned(root, 'typeorm');

  it('says so when the entities of the index no longer name a table a migration created', () => {
    const root = projectWithEntities(
      `import { orders } from '${SOURCE}';\nexport const entities = [\n  // orders,\n];\n`,
    );

    expect(said(root)).toContain('drops the tables of the context ordering (ordering.orders)');
    expect(said(root)).toContain('typeorm');
  });

  it('says nothing while they name it', () => {
    expect(said(projectWithEntities(`import { orders } from '${SOURCE}';\nexport const entities = [orders];\n`))).toBe(
      '',
    );
  });

  it('says nothing of a context that has no persistence folder yet', () => {
    const root = projectWithEntities(`import { orders } from '${SOURCE}';\nexport const entities = [orders];\n`);

    write(
      root,
      'ddd-ts-kit.config.json',
      JSON.stringify({ contexts: { ordering: { classification: 'core' }, billing: { classification: 'core' } } }),
    );

    expect(said(root)).toBe('');
  });

  it('runs before the command of the project', () => {
    const root = projectWithEntities('export const entities = [];\n');

    expect(cli(root, 'typeorm-generate', 'migrations/next').stderr).toContain(
      'drops the tables of the context ordering',
    );
  });
});

describe('the warning on the tables files the generators write', () => {
  const INDEX = 'src/platform/database/schema.ts';

  it('reads a Drizzle tables file', () => {
    const root = orderingProject('drizzle');

    write(
      root,
      'migrations/meta/_journal.json',
      JSON.stringify({ entries: [{ idx: 0, tag: '20260101120000_orders' }] }),
    );

    write(root, 'migrations/meta/20260101120000_snapshot.json', JSON.stringify({ tables: { 'ordering.orders': {} } }));

    expect(warned(root, 'drizzle-kit')).toBe('');

    write(root, INDEX, read(root, INDEX).replace(/export \* from '[^']*ordering\.schema';\n/, ''));

    expect(warned(root, 'drizzle-kit')).toContain('ordering.orders');
  });

  it('reads a TypeORM tables file', () => {
    const root = orderingProject('typeorm');

    write(root, 'migrations/1-init.ts', 'query(`CREATE TABLE "ordering"."orders" ("id" text)`);\n');

    expect(warned(root, 'typeorm')).toBe('');

    write(root, INDEX, read(root, INDEX).replace(/^ {2}orders,\n/m, ''));

    expect(warned(root, 'typeorm')).toContain('ordering.orders');
    commitAll(root);
    ok(cli(root, 'init', '--force'));
    expect(warned(root, 'typeorm')).toBe('');
  });
});
