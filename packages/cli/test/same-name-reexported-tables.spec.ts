import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import { CONTEXTS, INDEX, regionOf, sourceOf, tablesOf } from './support/same-name-project';

const MOVED = 'src/contexts/shipping/infrastructure/persistence/shipping-tables.ts';
const SHIPPING_LINE = `export { orders as shippingOrders } from '${sourceOf('shipping')}';`;

/** An aggregate of a context with its repository: what the command printed. */
function store(root: string, context: string, aggregate: string): string {
  expectOk(cli(root, 'generate', 'aggregate', context, aggregate, '--term', `${aggregate}=What ${context} keeps`));

  return expectOk(cli(root, 'generate', 'repository', context, aggregate)).stdout;
}

/** A Drizzle project whose contexts billing and shipping each store Order, the index settled between them. */
function ordersInTwoContexts(): string {
  const root = initProject('--orm', 'drizzle', ...CONTEXTS);

  store(root, 'billing', 'Order');
  store(root, 'shipping', 'Order');

  expect(regionOf(root, 'schemas')).toContain(SHIPPING_LINE);

  return root;
}

/** The tables of shipping moved to a file of their own, which its tables file re-exports through `specifier`. */
function moveTheTables(root: string, specifier: string): void {
  write(root, MOVED, read(root, tablesOf('shipping')));
  write(root, tablesOf('shipping'), `export * from '${specifier}';\n`);
}

describe('a tables file a team wrote its own way, on Drizzle', () => {
  it('keeps the line of a table its tables file re-exports from a file beside it, and says nothing', () => {
    const root = ordersInTwoContexts();

    moveTheTables(root, './shipping-tables');

    expect(store(root, 'billing', 'Invoice')).not.toContain('orders');
    expect(regionOf(root, 'schemas')).toContain(SHIPPING_LINE);

    commitAll(root);

    expect(expectOk(cli(root, 'init', '--force')).stdout).not.toContain('`orders`');
    expect(regionOf(root, 'schemas')).toContain(SHIPPING_LINE);
  });

  it('keeps the line of a table its tables file declares and exports apart', () => {
    const root = ordersInTwoContexts();
    const tables = read(root, tablesOf('shipping'));

    write(root, tablesOf('shipping'), `${tables.replace('export const orders', 'const orders')}\nexport { orders };\n`);
    store(root, 'billing', 'Invoice');

    expect(regionOf(root, 'schemas')).toContain(SHIPPING_LINE);
  });

  it('reads a tables file that re-exports a file of the project through the alias as one that names it by a relative path', () => {
    const root = ordersInTwoContexts();
    const before = read(root, INDEX);

    moveTheTables(root, '@/contexts/shipping/infrastructure/persistence/shipping-tables');

    expect(store(root, 'billing', 'Invoice')).not.toContain(`${INDEX}:`);
    expect(read(root, INDEX)).toBe(before);
    expect(store(root, 'returns', 'Order')).toContain('lists the name `orders` of returns as `returnsOrders`');
  });

  it('says nothing of a module re-exported whole that it does not find: what it exports is not known', () => {
    const root = ordersInTwoContexts();

    store(root, 'returns', 'Parcel');
    write(root, tablesOf('returns').replace('returns.schema.ts', 'legacy.mts'), 'export const orders = 1;\n');
    write(root, tablesOf('returns'), `${read(root, tablesOf('returns'))}\nexport * from './legacy.mjs';\n`);

    const before = read(root, INDEX);

    expect(store(root, 'billing', 'Invoice')).not.toContain(`${INDEX}`.concat(':'));
    expect(read(root, INDEX)).toBe(before);
  });

  it('says nothing of a package re-exported whole: it is not looked into', () => {
    const root = ordersInTwoContexts();

    moveTheTables(root, '@acme/tables');
    write(root, INDEX, read(root, INDEX).replace(/^export \{.*\n/gm, ''));

    expect(store(root, 'billing', 'Invoice')).not.toContain(`${INDEX}:`);
  });

  it('leaves to the team the name of a table it cannot prove free, with the lines to write by hand', () => {
    const root = ordersInTwoContexts();

    moveTheTables(root, './shipping-tables.mjs');

    const said = store(root, 'returns', 'Order');

    expect(said).toContain(`${INDEX}: the kit wrote no name in it: it does not read with certainty`);

    expect(said).toContain(
      `To write by hand, after its \`export *\` lines:\n  export { orders as returnsOrders } from '${sourceOf('returns')}';`,
    );

    expect(read(root, INDEX)).not.toContain('returnsOrders');
    expect(regionOf(root, 'schemas')).toContain(`export * from '${sourceOf('returns')}';`);
  });

  it('reads as taken a name that reaches the index through a file the tables file re-exports', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      'src/contexts/billing/infrastructure/persistence/more-tables.ts',
      "import { text } from 'drizzle-orm/pg-core';\nimport { billingSchema } from './billing.schema';\n\nexport const shippingOrders = billingSchema.table('shipping_orders', { id: text('id').primaryKey() });\n",
    );

    write(root, tablesOf('billing'), `${read(root, tablesOf('billing'))}\nexport * from './more-tables';\n`);
    store(root, 'shipping', 'Order');

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as shippingContextOrders } from '${sourceOf('shipping')}';`,
    ]);
  });
});

describe('what init --force says of a name two imports bind, on TypeORM', () => {
  it('names the name that was bound twice, not the entity behind it', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'ShippingOrder');
    store(root, 'shipping', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace('import { orders } from', 'import { orders as shippingOrders } from')
        .replace('  orders,\n', ''),
    );

    commitAll(root);

    expect(expectOk(cli(root, 'init', '--force')).stdout).toContain(
      `${INDEX} imported two entities under the name \`shippingOrders\`: \`orders\` of shipping is now imported as \`shippingContextOrders\``,
    );
  });
});
