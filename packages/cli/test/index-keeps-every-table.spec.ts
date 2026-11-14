import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { byNameLines, CONTEXTS, expectNoTableLost, INDEX, store } from './support/index-invariant';
import { initProject } from './support/init-project';
import { READABLE_SHAPES, unreadShapes } from './support/tables-file-shapes';

/** billing laid out in modules, its tables file in `shared/`, as `context-layout` leaves it. */
function laidOutInModules(root: string): void {
  commitAll(root);

  expectOk(
    cli(
      root,
      'generate',
      'module',
      'billing',
      'invoicing',
      '--purpose',
      'Bills the orders.',
      '--term',
      'Invoicing=billing the orders',
    ),
  );

  expectOk(cli(root, 'context-layout', 'billing'));
  commitAll(root);
}

const SHAPES = [
  ['laid out in modules', laidOutInModules, true] as const,
  ...Object.entries(READABLE_SHAPES).map(([name, shape]) => [name, shape, true] as const),
  ...Object.entries(unreadShapes('drizzle')).map(([name, shape]) => [name, shape, false] as const),
];

const BOTH = ['billing.orders', 'shipping.orders'];

/** A Drizzle project whose context billing stores Order, its tables file then written in a shape. */
function billingStoresOrder(shape: (root: string) => void): string {
  const root = initProject('--orm', 'drizzle', ...CONTEXTS);

  store(root, 'billing', 'Order');
  shape(root);

  return root;
}

describe('the schema index of a Drizzle project keeps every table, whatever the shape of a tables file', () => {
  it.each(SHAPES)('after generate repository in another context, billing %s', async (_name, shape, readable) => {
    const root = billingStoresOrder(shape);
    const unsettled = byNameLines(read(root, INDEX));

    const said = store(root, 'shipping', 'Order');

    await expectNoTableLost(root, { unsettled, tables: BOTH, said, readable });
  });

  it.each(SHAPES)('after generate read-model in another context, billing %s', async (_name, shape, readable) => {
    const root = billingStoresOrder(shape);
    const unsettled = byNameLines(read(root, INDEX));

    const said = expectOk(cli(root, 'generate', 'read-model', 'shipping', 'Orders')).stdout;

    await expectNoTableLost(root, { unsettled, tables: BOTH, said, readable });
  });

  it.each(SHAPES)(
    'after two generations in a third context, both names settled, billing %s',
    async (_name, shape, readable) => {
      const root = initProject('--orm', 'drizzle', ...CONTEXTS);

      store(root, 'billing', 'Order');
      store(root, 'shipping', 'Order');
      shape(root);

      const unsettled = byNameLines(read(root, INDEX));

      const first = store(root, 'returns', 'Parcel');

      await expectNoTableLost(root, { unsettled, tables: [...BOTH, 'returns.parcels'], said: first, readable });

      const said = store(root, 'returns', 'Order');
      const tables = [...BOTH, 'returns.parcels', 'returns.orders'];

      await expectNoTableLost(root, { unsettled, tables, said, readable });
    },
  );

  it.each(SHAPES)('after init --force on an index nothing settled, billing %s', async (_name, shape, readable) => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    write(root, INDEX, read(root, INDEX).replace(/^export \{.*\n/gm, ''));
    shape(root);
    commitAll(root);

    const unsettled = byNameLines(read(root, INDEX));
    const said = expectOk(cli(root, 'init', '--force')).stdout;

    await expectNoTableLost(root, { unsettled, tables: BOTH, said, readable });
  });
});

describe('an index a team added lines to, no name shared', () => {
  const EXTRA = "export * from '../extra';\n";
  const RELATIVE = "export * from '../../contexts/billing/infrastructure/persistence/billing.schema';";

  /** The index with a module of the platform re-exported whole and the line of billing written as a relative path. */
  function byHand(root: string): void {
    write(root, 'src/platform/extra.ts', 'export const extra = 1;\n');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace(/^export \* from '@\/contexts\/billing\/[^']+';$/m, RELATIVE)
        .replace('// ddd-ts-kit:schemas\n', `// ddd-ts-kit:schemas\n${EXTRA}`),
    );
  }

  it('is left as the generators and init --force write it without a settle, and no command fails', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    byHand(root);
    store(root, 'shipping', 'Parcel');
    expectOk(cli(root, 'generate', 'read-model', 'returns', 'Refunds'));
    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(read(root, INDEX)).not.toMatch(/^export \{/m);
    expect(read(root, INDEX)).toContain(EXTRA);
  });

  it('holds on Drizzle, when no name is shared, the region written here by hand as the kit wrote it before this fix', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Parcel');
    expectOk(cli(root, 'generate', 'read-model', 'returns', 'Refunds'));

    expect(read(root, INDEX)).toContain(
      `// ddd-ts-kit:schemas\nexport * from ${from('billing')}\nexport * from ${from('shipping')}\nexport * from ${from('returns')}\n// /ddd-ts-kit:schemas\n`,
    );
  });
});
