import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { freeName } from '../src/generate/kinds/same-name/free-name';
import { toName } from '../src/naming/to-name';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import { CONTEXTS, INDEX, regionOf, sourceOf, storeBoth, tablesOf, twoContextsOn } from './support/same-name-project';

/** An aggregate of a context with its repository, its term given. */
function store(root: string, context: string, aggregate: string): string {
  expectOk(cli(root, 'generate', 'aggregate', context, aggregate, '--term', `${aggregate}=What ${context} keeps`));

  return expectOk(cli(root, 'generate', 'repository', context, aggregate)).stdout;
}

describe('the name a second table takes in the index, when a table already bears it', () => {
  it('leaves `shippingOrders` to the table that bears it on Drizzle, whichever comes first', () => {
    const before = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(before, 'billing', 'Order');
    store(before, 'billing', 'ShippingOrder');
    store(before, 'shipping', 'Order');

    expect(regionOf(before, 'schemas').slice(2)).toEqual([
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as shippingContextOrders } from '${sourceOf('shipping')}';`,
    ]);

    const after = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(after, 'billing', 'Order');
    store(after, 'shipping', 'Order');
    store(after, 'billing', 'ShippingOrder');

    expect(regionOf(after, 'schemas').slice(2)).toEqual([
      `export { orders } from '${sourceOf('billing')}';`,
      `export { orders as shippingOrders } from '${sourceOf('shipping')}';`,
      `export { shippingOrders as billingShippingOrders } from '${sourceOf('billing')}';`,
    ]);
  });

  it('leaves `shippingSchema` to the database schema of the context on Drizzle', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    expectOk(cli(root, 'generate', 'read-model', 'billing', 'Schema', '--allow-name'));
    expectOk(cli(root, 'generate', 'read-model', 'shipping', 'Schema', '--allow-name'));

    expect(read(root, tablesOf('shipping'))).toContain("export const shippingSchema = contextSchema('shipping');");

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      `export { schema } from '${sourceOf('billing')}';`,
      `export { schema as shippingContextSchema } from '${sourceOf('shipping')}';`,
    ]);
  });

  it('leaves `shippingOrders` to the entity that bears it on TypeORM, whichever comes first', () => {
    const before = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(before, 'billing', 'Order');
    store(before, 'billing', 'ShippingOrder');
    store(before, 'shipping', 'Order');

    expect(regionOf(before, 'imports')).toEqual([
      `import { orders, shippingOrders } from '${sourceOf('billing')}';`,
      `import { orders as shippingContextOrders } from '${sourceOf('shipping')}';`,
    ]);

    expect(regionOf(before, 'schemas')).toEqual(['orders,', 'shippingOrders,', 'shippingContextOrders,']);

    const after = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(after, 'billing', 'Order');
    store(after, 'shipping', 'Order');
    store(after, 'billing', 'ShippingOrder');

    expect(regionOf(after, 'imports')).toEqual([
      'import {',
      'orders,',
      'shippingOrders as billingShippingOrders,',
      `} from '${sourceOf('billing')}';`,
      `import { orders as shippingOrders } from '${sourceOf('shipping')}';`,
    ]);

    expect(regionOf(after, 'schemas')).toEqual(['orders,', 'shippingOrders,', 'billingShippingOrders,']);
  });

  it('takes the first name nothing holds: the context, the context spelled out, then a number', () => {
    const shipping = toName('shipping');
    const held = ['shippingOrders', 'shippingContextOrders', 'shippingOrders2'];

    expect(freeName(shipping, 'orders', () => false)).toBe('shippingOrders');
    expect(freeName(shipping, 'orders', (name) => name === 'shippingOrders')).toBe('shippingContextOrders');
    expect(freeName(shipping, 'orders', (name) => held.includes(name))).toBe('shippingOrders3');
    expect(freeName(shipping, 'orders', () => true)).toBe('shippingOrders');
  });
});

describe('what the generators and init --force say of a name they settle', () => {
  it('says under which name the index lists the second table, on Drizzle and on TypeORM', () => {
    const drizzle = initProject('--orm', 'drizzle', ...CONTEXTS);
    const typeorm = initProject('--orm', 'typeorm', ...CONTEXTS);

    expect(store(drizzle, 'billing', 'Order')).not.toContain('lists the name');
    expect(store(typeorm, 'billing', 'Order')).not.toContain('lists the entity');

    expect(store(drizzle, 'shipping', 'Order')).toContain(
      `${INDEX} lists the name \`orders\` of shipping as \`shippingOrders\``,
    );

    expect(store(typeorm, 'shipping', 'Order')).toContain(
      `${INDEX} lists the entity \`orders\` of shipping as \`shippingOrders\``,
    );
  });

  it('says so when init --force settles an index that held both tables under one name, on Drizzle', () => {
    const root = twoContextsOn('drizzle');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .split('\n')
        .filter((line) => !line.startsWith('export {'))
        .join('\n'),
    );

    commitAll(root);

    const forced = expectOk(cli(root, 'init', '--force'));

    expect(forced.stdout).toContain(`${INDEX} lists the name \`parcels\` of shipping as \`shippingParcels\``);
  });

  it('says to wire the table by hand in a project that no longer holds the index, and settles nothing', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    fs.rmSync(path.join(root, INDEX));

    expect(store(root, 'billing', 'Order')).toContain(`${INDEX} does not exist: wire the new element by hand.`);
  });

  it('never removes a line of the index: the one of a table that is gone is left to the compiler', () => {
    const root = twoContextsOn('drizzle');
    const tables = read(root, tablesOf('shipping'));
    const line = `export { parcels as shippingParcels } from '${sourceOf('shipping')}';`;

    write(root, tablesOf('shipping'), tables.replace(/export const parcels = [\s\S]*?\n}\);\n/, ''));
    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(regionOf(root, 'schemas')).toContain(line);

    storeBoth(root, 'returns');

    expect(regionOf(root, 'schemas')).toContain(line);
  });
});
