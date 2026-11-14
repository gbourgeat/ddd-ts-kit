import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { READABLE_SHAPES, unreadShapes } from './support/tables-file-shapes';

const SHAPES = Object.entries({ ...READABLE_SHAPES, ...unreadShapes('typeorm') });
const BOTH = ['billing.orders', 'shipping.orders'];

/** The entities the index of a TypeORM project lists, once it loads. */
async function entitiesOf(root: string): Promise<readonly string[]> {
  const loaded = await loadedIndex(root);

  expect(loaded.error).toBeUndefined();

  return loaded.tables;
}

describe('the schema index of a TypeORM project keeps every entity, whatever the shape of a tables file', () => {
  it.each(SHAPES)(
    'after generate repository in another context, then init --force, billing %s',
    async (_name, shape) => {
      const root = initProject('--orm', 'typeorm', ...CONTEXTS);

      store(root, 'billing', 'Order');
      shape(root);
      store(root, 'shipping', 'Order');

      expect(await entitiesOf(root)).toEqual(expect.arrayContaining(BOTH));

      commitAll(root);
      expectOk(cli(root, 'init', '--force'));

      expect(await entitiesOf(root)).toEqual(expect.arrayContaining(BOTH));
    },
  );

  it('holds, when no name is shared, the regions written here by hand as the kit wrote them before this fix', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);
    const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Parcel');

    expect(read(root, INDEX)).toContain(
      `// ddd-ts-kit:imports\nimport { orders } from ${from('billing')}\nimport { parcels } from ${from('shipping')}\n// /ddd-ts-kit:imports\n`,
    );

    expect(read(root, INDEX)).toContain('  // ddd-ts-kit:schemas\n  orders,\n  parcels,\n  // /ddd-ts-kit:schemas\n');
  });
});
