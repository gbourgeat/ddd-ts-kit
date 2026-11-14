import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const persistence = (context: string): string => `src/contexts/${context}/infrastructure/persistence`;
const tablesOf = (context: string): string => `${persistence(context)}/${context}.schema.ts`;
const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;

const TABLE =
  "import { pgTable, text } from 'drizzle-orm/pg-core';\n\nexport const orders = pgTable('NAME', { id: text('id').primaryKey() });\n";

/** The table each name of the index is bound to, the index loaded for real. */
async function boundOf(root: string): Promise<Readonly<Record<string, string>>> {
  const loaded = await loadedIndex(root);

  expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });

  return loaded.bound;
}

/** The entities the index of a TypeORM project lists, the index loaded for real. */
async function entitiesOf(root: string): Promise<readonly string[]> {
  const loaded = await loadedIndex(root);

  expect({ error: loaded.error, twice: loaded.twice }).toEqual({ error: undefined, twice: [] });

  return loaded.tables;
}

/** No name the index exported names another table than it did. */
function expectNoNameMoved(before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): void {
  expect(Object.fromEntries(Object.keys(before).map((name) => [name, after[name]]))).toEqual(before);
}

describe('on TypeORM, an entity imported under a second name that is not listed is left alone', () => {
  const second = `import { orders as bOrders } from ${from('billing')}\n`;

  it('by init --force: the entity stays listed', async () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Parcel');
    store(root, 'returns', 'Parcel');
    write(root, INDEX, read(root, INDEX).replace('// ddd-ts-kit:imports\n', `// ddd-ts-kit:imports\n${second}`));
    commitAll(root);

    expectOk(cli(root, 'init', '--force'));

    expect(await entitiesOf(root)).toEqual(
      expect.arrayContaining(['billing.orders', 'shipping.parcels', 'returns.parcels']),
    );
  });

  it('by merge-trunk: the entity stays listed, and the merge records no loss it accepted', async () => {
    const root = twoSides({
      orm: 'typeorm',
      base: (project) => {
        store(project, 'billing', 'Order');

        write(
          project,
          INDEX,
          `${read(project, INDEX).replace('// /ddd-ts-kit:imports\n', `${second}// /ddd-ts-kit:imports\n`)}\nexport const ordersTable = bOrders.options.name;\n`,
        );
      },
      trunk: (project) => void store(project, 'returns', 'Invoice'),
      branch: (project) => void store(project, 'shipping', 'Crate'),
    });

    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);

    expect(await entitiesOf(root)).toEqual(
      expect.arrayContaining(['billing.orders', 'returns.invoices', 'shipping.crates']),
    );

    expect(git(root, 'log', '-1', '--format=%B')).not.toContain('Lost-Accepted');
  });
});

describe('what the compiler resolves otherwise than the kit is not resolved, and what it resolves the same is read', () => {
  it('reads the folder a `..` names, never the file of its name beside it', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, 'src/legacy/index.ts', TABLE.replace('NAME', 'legacy_orders'));
    write(root, 'src/legacy.ts', TABLE.replace('NAME', 'archive').replace('orders', 'archive'));
    write(root, 'src/legacy/sub/all.ts', "export * from '..';\n");

    for (const context of ['billing', 'returns']) {
      const declared = `export const orders = ${context}Schema.table('orders', { id: text('id').primaryKey() });\n`;

      store(root, context, 'Parcel');
      write(root, tablesOf(context), `${read(root, tablesOf(context))}\n${declared}`);
    }

    write(
      root,
      INDEX,
      read(root, INDEX).replace(
        '// ddd-ts-kit:schemas\n',
        "// ddd-ts-kit:schemas\nexport * from '@/legacy/sub/all';\n",
      ),
    );

    store(root, 'shipping', 'Crate');

    // Read as text: the runner of these specs resolves `..` to the file, where the compiler reads the folder.
    expect(read(root, INDEX).match(/^export \{ orders.*$/gm)).toEqual([
      "export { orders } from '@/legacy/sub/all';",
      `export { orders as billingOrders } from ${from('billing')}`,
      `export { orders as returnsOrders } from ${from('returns')}`,
    ]);
  });
});

describe('a name the index exports names the same table after init --force', () => {
  it('keeps the lines a team wrote after the region, where the index rewritten from its template would give the name to another table', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'returns', 'Order');

    write(
      root,
      INDEX,
      `${read(root, INDEX).replace(/^export \{.*\n/gm, '')}export { orders } from ${from('returns')}\nexport { orders as billingOrders } from ${from('billing')}\n`,
    );

    commitAll(root);

    const before = await boundOf(root);
    const forced = cli(root, 'init', '--force');
    const said = forced.stdout;

    expect(forced.code).toBe(3);
    expect(said).not.toContain(`updated      ${INDEX}`);
    expect(before).toMatchObject({ orders: 'returns.orders', billingOrders: 'billing.orders' });
    expect(said).toContain(`${INDEX} is left as it stood before the command`);
    expect(said).toContain('`orders`, which exported');
    expectNoNameMoved(before, await boundOf(root));
  });

  it('keeps a name a line by hand gives to a context while a module of the region exports it too', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, 'src/legacy/tables.ts', TABLE.replace('NAME', 'legacy_orders'));
    store(root, 'billing', 'Order');

    write(
      root,
      INDEX,
      `${read(root, INDEX)
        .replace(/^export \{.*\n/gm, '')
        .replace(
          '// ddd-ts-kit:schemas\n',
          "// ddd-ts-kit:schemas\nexport * from '@/legacy/tables';\n",
        )}export { orders } from ${from('billing')}\n`,
    );

    commitAll(root);

    const before = read(root, INDEX);
    const said = cli(root, 'init', '--force').stdout;

    expect(said).toContain(`${INDEX} is left as it stood before the command`);
    expect(read(root, INDEX)).toBe(before);
  });

  it('settles as before a project whose names no line by hand holds', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    store(root, 'returns', 'Parcel');
    commitAll(root);

    const before = await boundOf(root);

    expect(expectOk(cli(root, 'init', '--force')).stdout).not.toContain('is left as it stood');
    expectNoNameMoved(before, await boundOf(root));
  });
});

describe('a name the index exports names the same table after a generation', () => {
  it('is decided on what the tables file exports, never on a word of its text', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'shipping', 'Parcel');
    store(root, 'billing', 'Order');

    write(
      root,
      tablesOf('shipping'),
      `${read(root, tablesOf('shipping'))}\n// export const orders lives in billing for now\n`,
    );

    const before = await boundOf(root);

    store(root, 'shipping', 'Order');

    const after = await boundOf(root);

    expectNoNameMoved(before, after);
    expect(after).toMatchObject({ orders: 'billing.orders', shippingOrders: 'shipping.orders' });
  });

  it.each(['repository', 'read-model'])(
    'holds for generate %s in a context that shares several names',
    async (kind) => {
      const root = initProject('--orm', 'drizzle', ...CONTEXTS);

      store(root, 'billing', 'Order');
      store(root, 'shipping', 'Order');
      store(root, 'returns', 'Parcel');

      const before = await boundOf(root);

      if (kind === 'repository') {
        store(root, 'returns', 'Order');
        store(root, 'billing', 'Parcel');
      } else {
        expectOk(cli(root, 'generate', 'read-model', 'returns', 'Orders'));
        expectOk(cli(root, 'generate', 'read-model', 'billing', 'Parcels'));
      }

      const after = await boundOf(root);

      expectNoNameMoved(before, after);
      expect(after).toMatchObject({ returnsOrders: 'returns.orders', billingParcels: 'billing.parcels' });
    },
  );
});

describe('merge-trunk gives a name to the table the trunk exports under it, whatever the order of the index', () => {
  const base = (project: string): void => {
    for (const context of ['billing', 'shipping', 'returns']) {
      store(project, context, 'Parcel');
    }
  };

  it.each([
    ['returns', 'shipping'],
    ['shipping', 'returns'],
    ['billing', 'returns'],
  ])('on Drizzle, the trunk storing Invoice in %s and the branch in %s', async (onTrunk, onBranch) => {
    const root = twoSides({
      orm: 'drizzle',
      base,
      trunk: (project) => void store(project, onTrunk, 'Invoice'),
      branch: (project) => void store(project, onBranch, 'Invoice'),
    });

    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);
    expect(merged.stdout).not.toContain('did not find how to keep');

    expect(await boundOf(root)).toMatchObject({
      invoices: `${onTrunk}.invoices`,
      [`${onBranch}Invoices`]: `${onBranch}.invoices`,
    });
  });

  it.each([
    ['returns', 'shipping'],
    ['shipping', 'returns'],
  ])(
    'on TypeORM, the import of the trunk keeps its name: Invoice in %s on the trunk, in %s on the branch',
    async (onTrunk, onBranch) => {
      const root = twoSides({
        orm: 'typeorm',
        base,
        trunk: (project) => void store(project, onTrunk, 'Invoice'),
        branch: (project) => void store(project, onBranch, 'Invoice'),
      });

      const onTrunkBefore = git(root, 'show', `main:${INDEX}`).match(/^import \{.*\binvoices\b.*$/m)?.[0] ?? '';
      const merged = mergeTrunk(root);

      expect(merged.code, merged.stdout).toBe(0);
      expect(await entitiesOf(root)).toEqual(expect.arrayContaining([`${onTrunk}.invoices`, `${onBranch}.invoices`]));
      expect(onTrunkBefore).toContain(onTrunk);
      expect(read(root, INDEX)).toMatch(new RegExp(`invoices as ${onBranch}Invoices\\b`));
      expect(read(root, INDEX)).not.toMatch(new RegExp(`invoices as ${onTrunk}Invoices\\b`));
    },
  );

  it('settles between the tables left when the trunk took one away and the branch brings another', async () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'returns', 'Order');
      },
      trunk: (project) => {
        write(
          project,
          tablesOf('billing'),
          read(project, tablesOf('billing')).replace(/export const orders = [\s\S]*?\n\}\);\n/, ''),
        );

        write(project, INDEX, read(project, INDEX).replace(/^export \{ orders.*\n/gm, ''));
      },
      branch: (project) => void store(project, 'shipping', 'Order'),
    });

    const merged = mergeTrunk(root);

    expect(merged.stdout).not.toContain('did not find how to keep');
    expect(await boundOf(root)).toMatchObject({ orders: 'returns.orders', shippingOrders: 'shipping.orders' });
  });

  it('writes nothing when the branch brings a module that is no tables file and exports a name of the trunk', () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => void store(project, 'billing', 'Order'),
      trunk: (project) => void store(project, 'billing', 'Invoice'),
      branch: (project) => {
        write(project, 'src/legacy/tables.ts', TABLE.replace('NAME', 'legacy_orders'));

        write(
          project,
          INDEX,
          read(project, INDEX).replace(
            '// /ddd-ts-kit:schemas\n',
            "export * from '@/legacy/tables';\n// /ddd-ts-kit:schemas\n",
          ),
        );
      },
    });

    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain('what it was about to write would leave under no name src/legacy/tables.ts#orders');
    expect(merged.stdout).toContain(`export { orders } from ${from('billing')}`);
    expect(read(root, INDEX)).not.toMatch(/^export \{/m);
  });
});
