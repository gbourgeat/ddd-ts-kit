import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const tablesOf = (context: string): string => `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;
const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;

/** The lines of the index that export by name: those a settle writes. */
function settled(root: string): string[] {
  return (read(root, INDEX).match(/^export (?:type )?\{.*$/gm) ?? []).sort();
}

/** A name a tables file declares as a value and as a type at once, as a team writes the type of a row beside its table. */
const DUAL: Readonly<Record<string, { name: string; declared: (context: string) => string }>> = {
  'a table and the type of its rows': {
    name: 'invoices',
    declared: (context) =>
      `export const invoices = ${context}Schema.table('invoices', { id: text('id').primaryKey() });\nexport type invoices = typeof invoices.$inferSelect;\n`,
  },
  'an enum and the type of its values': {
    name: 'Status',
    declared: (context) =>
      `export const Status = ${context}Schema.enum('status', ['on', 'off']);\nexport type Status = (typeof Status.enumValues)[number];\n`,
  },
  'a class and an interface': {
    name: 'Row',
    declared: () => 'export class Row {}\nexport interface Row {\n  readonly id: string;\n}\n',
  },
};

const FORMS = Object.entries(DUAL).map(([form, { name, declared }]) => ({ form, name, declared }));

function declare(root: string, context: string, declared: (context: string) => string): void {
  write(root, tablesOf(context), `${read(root, tablesOf(context))}\n${declared(context)}`);
}

/** The index exports the name for the first context and an alias for the other, both as values, and holds every table. */
async function expectBothValues(root: string, name: string, [keeper, other]: readonly [string, string]): Promise<void> {
  const loaded = await loadedIndex(root);
  const alias = `${other}${name.charAt(0).toUpperCase()}${name.slice(1)}`;

  expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
  expect(loaded.exports).toEqual(expect.arrayContaining([name, alias]));
  expect(read(root, INDEX)).not.toMatch(new RegExp(`^export type \\{ ${name}\\b`, 'm'));

  if (name === 'invoices') {
    expect(loaded.bound).toMatchObject({ invoices: `${keeper}.invoices`, [alias]: `${other}.invoices` });
  }
}

/** A Drizzle project whose contexts billing and shipping each store Order, settled, and each declare the name both ways. */
function bothDeclare(declared: (context: string) => string): string {
  const root = initProject('--orm', 'drizzle', ...CONTEXTS);

  store(root, 'billing', 'Order');
  store(root, 'shipping', 'Order');
  declare(root, 'billing', declared);
  declare(root, 'shipping', declared);

  return root;
}

describe('a name two tables files declare as a value and as a type is settled as a value', () => {
  it.each(FORMS)('by generate repository in a third context: $form', async ({ name, declared }) => {
    const root = bothDeclare(declared);
    const said = store(root, 'returns', 'Parcel');

    expect(said).not.toContain('lists the type');
    await expectBothValues(root, name, ['billing', 'shipping']);
  });

  it.each(FORMS)('by generate read-model in a third context: $form', async ({ name, declared }) => {
    const root = bothDeclare(declared);

    expectOk(cli(root, 'generate', 'read-model', 'returns', 'Refunds'));

    await expectBothValues(root, name, ['billing', 'shipping']);
  });

  it.each(FORMS)('by init --force: $form', async ({ name, declared }) => {
    const root = bothDeclare(declared);

    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    await expectBothValues(root, name, ['billing', 'shipping']);
  });

  it.each(
    FORMS.flatMap((form) => [
      { ...form, trunk: 'billing', branch: 'shipping' },
      { ...form, trunk: 'shipping', branch: 'billing' },
    ]),
  )('by merge-trunk, the trunk holding $trunk: $form', async ({ name, declared, trunk, branch }) => {
    const side = (context: string) => (project: string) => {
      store(project, context, 'Order');
      declare(project, context, declared);
    };

    const root = twoSides({ orm: 'drizzle', trunk: side(trunk), branch: side(branch) });
    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);
    await expectBothValues(root, name, [trunk, branch]);
  });

  it('settles each file by what it holds: a value in one, a type alone in the other', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Parcel');
    declare(root, 'billing', DUAL['a table and the type of its rows']?.declared ?? (() => ''));
    declare(root, 'shipping', () => 'export type invoices = { readonly id: string };\n');

    const said = store(root, 'returns', 'Refund');
    const loaded = await loadedIndex(root);

    expect(settled(root)).toEqual([
      `export type { invoices as shippingInvoices } from ${from('shipping')}`,
      `export { invoices } from ${from('billing')}`,
    ]);

    expect(said).toContain('lists the type `invoices` of shipping as `shippingInvoices`');
    expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
    expect(loaded.bound).toMatchObject({ invoices: 'billing.invoices' });
  });
});

describe('one symbol two tables files re-export is one symbol', () => {
  const SHARED = [
    "import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';",
    '',
    "export const currency = pgEnum('currency', ['eur', 'usd']);",
    "export const countries = pgTable('countries', { code: text('code').primaryKey() });",
    '',
  ].join('\n');

  it('is left to the `export *` lines, as before: nothing written, nothing said', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const star = "export * from '../../../../shared-kernel/persistence/shared';\n";

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Shipment');
    write(root, 'src/shared-kernel/persistence/shared.ts', SHARED);
    write(root, tablesOf('billing'), `${read(root, tablesOf('billing'))}\n${star}`);
    write(root, tablesOf('shipping'), `${read(root, tablesOf('shipping'))}\n${star}`);

    const said = store(root, 'returns', 'Parcel');
    const loaded = await loadedIndex(root);

    expect(said).not.toContain(`${INDEX}`.concat(':'));
    expect(said).not.toContain('lists the');

    expect(read(root, INDEX)).toContain(
      `// ddd-ts-kit:schemas\nexport * from ${from('billing')}\nexport * from ${from('shipping')}\nexport * from ${from('returns')}\n// /ddd-ts-kit:schemas\n`,
    );

    expect(loaded.error).toBeUndefined();
    expect(loaded.tables).toEqual(expect.arrayContaining(['.countries', 'returns.parcels']));
  });

  it('counts a tables file the index re-exports twice once', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX).replace(`export * from ${from('billing')}\n`, (line) => `${line}${line}`),
    );

    const said = store(root, 'shipping', 'Parcel');

    expect(said).not.toContain(`${INDEX}`.concat(':'));
    expect(settled(root)).toEqual([]);
  });
});

describe('a name the index gives by hand to something else', () => {
  const LEGACY =
    "import { pgTable, text } from 'drizzle-orm/pg-core';\n\nexport const orders = pgTable('legacy_orders', { id: text('id').primaryKey() });\n";

  it('leaves the table of a context under a name of its own when the index imports the name then exports it', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, 'src/legacy/tables.ts', LEGACY);
    write(root, INDEX, `import { orders } from '@/legacy/tables';\n${read(root, INDEX)}\nexport { orders };\n`);

    const said = store(root, 'billing', 'Order');
    const loaded = await loadedIndex(root);

    expect(said).toContain('lists the name `orders` of billing as `billingOrders`');
    expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
    expect(loaded.bound).toMatchObject({ orders: '.legacy_orders', billingOrders: 'billing.orders' });
  });

  it('says once which line to write when the index exports the name in a way it does not read', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, 'src/legacy/tables.ts', LEGACY);

    write(
      root,
      INDEX,
      `import * as legacy from '@/legacy/tables';\n${read(root, INDEX)}\nexport const { orders } = legacy;\n`,
    );

    const said = store(root, 'billing', 'Order');

    expect(said.split('the kit wrote no name in it')).toHaveLength(2);
    expect(said).toContain('which may export `orders`');
    expect(said).toContain(`  export { orders as billingOrders } from ${from('billing')}`);
    expect(settled(root)).toEqual([]);
  });
});

describe('what is certain is not said', () => {
  it('says nothing of a tables file that takes a name by name from a package, or that writes the name of another table in a comment or a column', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      tablesOf('billing'),
      `${read(root, tablesOf('billing'))}\nexport { auditColumns } from '@ddd-ts-kit/drizzle/postgres';\n// The parcels of shipping are not here.\nexport const notes = billingSchema.table('notes', { parcels: text('parcels') });\n`,
    );

    const said = [store(root, 'shipping', 'Parcel'), store(root, 'returns', 'Refund')];

    commitAll(root);
    said.push(expectOk(cli(root, 'init', '--force')).stdout);

    expect(said.join('\n')).not.toContain(`${INDEX}`.concat(':'));
    expect(settled(root)).toEqual([]);
  });

  it('gives every line to write by hand, the `export *` line first, to an index that holds no region', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    write(root, INDEX, read(root, INDEX).replace(/^\/\/ \/?ddd-ts-kit:schemas\n/gm, ''));

    const said = store(root, 'shipping', 'Order');

    expect(said).toContain(
      `To write by hand, after its \`export *\` lines:\n  export * from ${from('shipping')}\n  export { orders } from ${from('billing')}\n  export { orders as shippingOrders } from ${from('shipping')}`,
    );
  });
});
