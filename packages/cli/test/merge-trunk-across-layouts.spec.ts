import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

/** What a merge across layouts must never say: each table is the same table on both sides. */
const FALSE =
  /lists the name|now names|is exported under no name|is left as|the kit wrote no name|which the index of the/;

/** billing laid out in modules, `invoicing` its first module, and an Invoice in it: what a side that reorganises billing does. */
function layOutBilling(project: string): void {
  const run = (...args: string[]): void => void expectOk(cli(project, ...args));

  commitAll(project);

  run(
    'generate',
    'module',
    'billing',
    'invoicing',
    '--purpose',
    'Bills the orders.',
    '--term',
    'Invoicing=billing the orders',
  );

  run('context-layout', 'billing');
  commitAll(project);
  run('generate', 'aggregate', 'billing', 'Invoice', '--module', 'invoicing', '--term', 'Invoice=a bill');
  run('generate', 'repository', 'billing', 'Invoice', '--module', 'invoicing');
}

/** The base: billing stores Order and shipping Order, the name shared, or Parcel, no name shared. */
function base(shared: boolean): (project: string) => void {
  return (project) => {
    store(project, 'billing', 'Order');
    store(project, 'shipping', shared ? 'Order' : 'Parcel');
  };
}

const CASES = ['drizzle', 'typeorm'].flatMap((orm) =>
  [true, false].flatMap((shared) => [
    { orm, shared, laidOut: 'branch' as const },
    { orm, shared, laidOut: 'trunk' as const },
  ]),
);

describe('merge-trunk between a side that lays a context out in modules and one that keeps it flat', () => {
  it.each(CASES)(
    'on $orm, billing laid out on the $laidOut, a name shared: $shared',
    async ({ orm, shared, laidOut }) => {
      const flat = (project: string): void =>
        void store(project, laidOut === 'branch' ? 'shipping' : 'returns', 'Crate');

      const root = twoSides({
        orm,
        base: base(shared),
        trunk: laidOut === 'trunk' ? layOutBilling : flat,
        branch: laidOut === 'branch' ? layOutBilling : flat,
      });

      const previewed = mergeTrunk(root, '--dry-run');
      const merged = mergeTrunk(root);
      const loaded = await loadedIndex(root);

      expect(merged.code, merged.stdout).toBe(0);
      expect(previewed.stdout).not.toMatch(FALSE);
      expect(merged.stdout).not.toMatch(FALSE);

      expect({ error: loaded.error, missing: loaded.missing, twice: loaded.twice }).toEqual({
        error: undefined,
        missing: [],
        twice: [],
      });

      expect(loaded.tables).toEqual(expect.arrayContaining(['billing.orders', 'billing.invoices']));

      if (orm === 'drizzle' && shared) {
        expect(loaded.bound).toMatchObject({ orders: 'billing.orders', shippingOrders: 'shipping.orders' });
      }

      if (orm === 'drizzle' && !shared) {
        expect(read(root, INDEX)).not.toMatch(/^export \{/m);
      }
    },
  );
});
