import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { INDEX, store, unsettle } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';

const CONTEXTS = ['billing:core', 'shipping:supporting', 'returns:supporting', 'claims:supporting'].flatMap((name) => [
  '--context',
  name,
]);

const HOLDERS = [
  ['billing', 'shipping'],
  ['billing', 'shipping', 'returns'],
] as const;

const COMMANDS = ['repository', 'read-model'] as const;

const CASES = HOLDERS.flatMap((holders) => {
  return COMMANDS.flatMap((command) => [
    { holders, command, stored: 'Order' },
    { holders, command, stored: 'Parcel' },
  ]);
});

/** A Drizzle project whose contexts each store Order, the name `orders` settled by nothing in the index. */
function sharedUnsettled(holders: readonly string[]): string {
  const root = initProject('--orm', 'drizzle', ...CONTEXTS);

  holders.forEach((holder) => store(root, holder, 'Order'));
  unsettle(root);

  return root;
}

/** What claims generates: an aggregate with its repository, or the read model of the same table name. */
function generateInClaims(root: string, command: string, stored: string): string {
  if (command === 'repository') {
    return store(root, 'claims', stored);
  }

  return expectOk(cli(root, 'generate', 'read-model', 'claims', `${stored}s`)).stdout;
}

/** The name each table bears once every shared name is settled: the first context keeps it, the others bear theirs. */
function settledNames(holders: readonly string[], stored: string): Record<string, string> {
  const [keeper = '', ...others] = holders;
  const renamed = others.map((holder) => [`${holder}Orders`, `${holder}.orders`]);
  const brought = stored === 'Order' ? ['claimsOrders', 'claims.orders'] : ['parcels', 'claims.parcels'];

  return Object.fromEntries([['orders', `${keeper}.orders`], ...renamed, brought]);
}

describe('a generation in a context settles the names the other contexts share, none settled before it', () => {
  it.each(CASES)(
    'generate $command of $stored in claims, `orders` shared by $holders',
    async ({ holders, command, stored }) => {
      const root = sharedUnsettled(holders);

      generateInClaims(root, command, stored);

      const loaded = await loadedIndex(root);

      expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
      expect(loaded.bound).toMatchObject(settledNames(holders, stored));
    },
  );

  it('settles them once the line that kept the kit from reading the index is gone', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const extra = "export * from '@/extra';\n";

    write(root, 'src/extra.ts', 'export const extra = 1;\n');
    write(root, INDEX, read(root, INDEX).replace('// ddd-ts-kit:schemas\n', `// ddd-ts-kit:schemas\n${extra}`));
    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    write(root, INDEX, read(root, INDEX).replace(extra, ''));

    store(root, 'returns', 'Order');

    const loaded = await loadedIndex(root);

    expect(loaded.missing).toEqual([]);

    expect(loaded.bound).toMatchObject({
      orders: 'billing.orders',
      shippingOrders: 'shipping.orders',
      returnsOrders: 'returns.orders',
    });
  });
});

describe('a type two tables files export under one name', () => {
  const TABLES = (context: string): string => `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;

  it.each([
    ['a type alias', 'export type Row = { readonly id: string };'],
    ['an interface', 'export interface Row {\n  readonly id: string;\n}'],
    ['a type exported in a list', 'type Held = { readonly id: string };\nexport type { Held as Row };'],
    ['a type marked in a list', 'type Held = { readonly id: string };\nexport { type Held as Row };'],
  ])('is settled as a type, never as a table: %s', async (_what, declaration) => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Parcel');
    write(root, TABLES('billing'), `${read(root, TABLES('billing'))}\n${declaration}\n`);
    write(root, TABLES('shipping'), `${read(root, TABLES('shipping'))}\n${declaration}\n`);

    const said = store(root, 'returns', 'Refund');
    const loaded = await loadedIndex(root);
    const lines = read(root, INDEX).match(/^export .*\bRow\b.*$/gm) ?? [];

    expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
    expect(lines.filter((line) => !line.startsWith('export type {'))).toEqual([]);
    expect(lines).toHaveLength(2);
    expect(said).not.toContain('the table `Row`');
  });
});
