import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { CONTEXTS, INDEX, store, unsettle } from './support/index-invariant';
import { type LoadedIndex, loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const persistence = (context: string): string => `src/contexts/${context}/infrastructure/persistence`;
const tablesOf = (context: string): string => `${persistence(context)}/${context}.schema.ts`;

const TABLE =
  "import { pgTable, text } from 'drizzle-orm/pg-core';\n\nexport const orders = pgTable('NAME', { id: text('id').primaryKey() });\n";

/** The lines of the index that export by name: those a settle writes. */
function settled(root: string): string[] {
  return (read(root, INDEX).match(/^export (?:type )?\{.*$/gm) ?? []).sort();
}

/** The table `orders` a context declares by hand in its tables file. */
function declareOrders(root: string, context: string): void {
  const declared = `export const orders = ${context}Schema.table('orders', { id: text('id').primaryKey() });\n`;

  write(root, tablesOf(context), `${read(root, tablesOf(context))}\n${declared}`);
}

/** How a state built by hand reaches a command that settles the index: what the command printed, the project it ran in. */
interface Reached {
  readonly root: string;
  readonly said: string;
}

type Side = (root: string) => void;

/** The three commands that settle an index, each on the same state: built in one project, or on the two sides of a merge. */
const COMMANDS: Readonly<Record<string, (trunk: Side, branch: Side) => Reached>> = {
  'generate repository': (trunk, branch) => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    trunk(root);
    branch(root);

    return { root, said: store(root, 'billing', 'Gadget') };
  },
  'init --force': (trunk, branch) => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    trunk(root);
    branch(root);
    commitAll(root);

    return { root, said: expectOk(cli(root, 'init', '--force')).stdout };
  },
  'merge-trunk': (trunk, branch) => {
    const root = twoSides({ orm: 'drizzle', trunk, branch });
    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);

    return { root, said: merged.stdout };
  },
};

const EACH = Object.entries(COMMANDS).map(([command, reach]) => ({ command, reach }));

function expectLoaded(loaded: LoadedIndex): void {
  expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
}

describe('a module the index re-exports whole is the tables file of a context only when it resolves to it', () => {
  const trunk: Side = (root) => {
    store(root, 'billing', 'Parcel');
    write(root, 'src/legacy/billing.schema.ts', TABLE.replace('NAME', 'legacy_orders'));
    declareOrders(root, 'billing');

    write(
      root,
      INDEX,
      read(root, INDEX).replace(
        '// ddd-ts-kit:schemas\n',
        "// ddd-ts-kit:schemas\nexport * from '@/legacy/billing.schema';\n",
      ),
    );
  };

  const branch: Side = (root) => {
    store(root, 'returns', 'Parcel');
    declareOrders(root, 'returns');
  };

  it.each(EACH)(
    'by $command: a file named like a tables file keeps its table, and each context its own',
    async ({ reach }) => {
      const { root } = reach(trunk, branch);
      const loaded = await loadedIndex(root);

      expectLoaded(loaded);

      expect(loaded.bound).toMatchObject({
        orders: '.legacy_orders',
        billingOrders: 'billing.orders',
        returnsOrders: 'returns.orders',
      });
    },
  );
});

describe('a name taken by name from a module of the project the kit does not find is a name of the file that takes it', () => {
  const legacy =
    (context: string): Side =>
    (root) => {
      store(root, context, 'Parcel');
      write(root, `${persistence(context)}/legacy.mts`, TABLE.replace('NAME', `${context}_legacy_orders`));
      write(root, tablesOf(context), `${read(root, tablesOf(context))}\nexport { orders } from './legacy.mjs';\n`);
    };

  const branch: Side = (root) => {
    legacy('shipping')(root);
    store(root, 'returns', 'Parcel');
    declareOrders(root, 'returns');
  };

  it.each(EACH)('by $command: each table keeps a name of its own', async ({ reach }) => {
    const { root } = reach(legacy('billing'), branch);
    const loaded = await loadedIndex(root);

    expectLoaded(loaded);

    expect(loaded.bound).toMatchObject({
      orders: '.billing_legacy_orders',
      shippingOrders: '.shipping_legacy_orders',
      returnsOrders: 'returns.orders',
    });
  });
});

describe('a module re-exported whole that the kit does not find', () => {
  it.each(EACH)(
    'by $command: no name is written for what it may hold, and the index is as the trunk leaves it',
    ({ reach }) => {
      const opaque: Side = (root) => {
        store(root, 'billing', 'Parcel');
        write(root, `${persistence('billing')}/legacy.mts`, TABLE.replace('NAME', 'billing_legacy_orders'));
        write(root, tablesOf('billing'), `${read(root, tablesOf('billing'))}\nexport * from './legacy.mjs';\n`);
      };

      const { root } = reach(opaque, (project) => {
        store(project, 'returns', 'Refund');
        declareOrders(project, 'returns');
      });

      expect(settled(root).filter((line) => line.includes('orders'))).toEqual([]);
    },
  );
});

describe('one file two tables files name differently is one file', () => {
  const SHARED = [
    "import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';",
    '',
    "export const currency = pgEnum('currency', ['eur', 'usd']);",
    "export const countries = pgTable('countries', { code: text('code').primaryKey() });",
    '',
  ].join('\n');

  const up = '../../../../shared-kernel/tables';

  const FORMS = [
    {
      form: 'by name, alias and relative',
      file: 'tables.ts',
      billing: "export { countries, currency } from '@/shared-kernel/tables';",
      shipping: `export { countries, currency } from '${up}';`,
    },
    {
      form: 'whole, alias and relative',
      file: 'tables.ts',
      billing: "export * from '@/shared-kernel/tables';",
      shipping: `export * from '${up}';`,
    },
    {
      form: 'whole, with and without an ending',
      file: 'tables.ts',
      billing: `export * from '${up}.js';`,
      shipping: "export * from '@/shared-kernel/tables';",
    },
    {
      form: 'a folder and its index',
      file: 'tables/index.ts',
      billing: "export * from '@/shared-kernel/tables/index';",
      shipping: `export { countries, currency } from '${up}';`,
    },
  ];

  const side =
    (context: string, file: string, line: string): Side =>
    (root) => {
      store(root, context, context === 'billing' ? 'Order' : 'Shipment');
      write(root, `src/shared-kernel/${file}`, SHARED);
      write(root, tablesOf(context), `${read(root, tablesOf(context))}\n${line}\n`);
    };

  it.each(EACH.flatMap((each) => FORMS.map((form) => ({ ...each, ...form }))))(
    'by $command, $form: nothing written, nothing said',
    async ({ reach, file, billing, shipping }) => {
      const { root, said } = reach(side('billing', file, billing), side('shipping', file, shipping));
      const loaded = await loadedIndex(root);

      expect(settled(root)).toEqual([]);
      expect(said).not.toContain('the kit wrote no name in it');
      expect(said).not.toContain('lists the');
      expectLoaded(loaded);
      expect(loaded.tables).toContain('.countries');
    },
  );
});

describe('what a tables file declares wins over what a module it re-exports whole brings', () => {
  const trunk: Side = (root) => {
    store(root, 'billing', 'Parcel');

    write(
      root,
      `${persistence('billing')}/extra.ts`,
      TABLE.replace('NAME', 'extra_parcels').replace('export const orders', 'export const parcels'),
    );

    write(root, tablesOf('billing'), `${read(root, tablesOf('billing'))}\nexport * from './extra';\n`);
  };

  it.each(EACH)('by $command: the name is settled between the tables the files export', async ({ reach }) => {
    const { root } = reach(trunk, (project) => void store(project, 'shipping', 'Parcel'));
    const loaded = await loadedIndex(root);

    expectLoaded(loaded);
    expect(loaded.bound).toMatchObject({ parcels: 'billing.parcels', shippingParcels: 'shipping.parcels' });
  });
});

describe('a name no line settled, in a context that held it before the command', () => {
  it('stays with the context the index re-exports first, as init --force gives it, and `default` is never settled', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    unsettle(root);

    for (const context of ['billing', 'shipping']) {
      write(root, tablesOf(context), `${read(root, tablesOf(context))}\nexport { orders as default };\n`);
    }

    store(root, 'billing', 'Gadget');

    const loaded = await loadedIndex(root);

    expectLoaded(loaded);
    expect(loaded.bound).toMatchObject({ orders: 'billing.orders', shippingOrders: 'shipping.orders' });
    expect(read(root, INDEX)).not.toMatch(/\bdefault\b/);
  });
});

describe('a name the index takes by name from a module', () => {
  it('is that name of a package: the table of a context that bears it is listed under its context', async () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, INDEX, `${read(root, INDEX)}\nexport { jobsTable as orders } from '@ddd-ts-kit/drizzle/postgres';\n`);

    const said = store(root, 'billing', 'Order');
    const loaded = await loadedIndex(root);

    expect(said).toContain('lists the name `orders` of billing as `billingOrders`');
    expectLoaded(loaded);
    expect(loaded.bound).toMatchObject({ billingOrders: 'billing.orders' });
  });

  it('is a name of the index when the kit does not find the module: the table of a context that bears it is listed under its context', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, 'src/platform/database/legacy.mts', TABLE.replace('NAME', 'legacy_orders'));
    write(root, INDEX, `${read(root, INDEX)}\nexport { orders } from './legacy.mjs';\n`);

    const said = store(root, 'billing', 'Order');

    expect(said).toContain('lists the name `orders` of billing as `billingOrders`');

    expect(settled(root)).toEqual([
      "export { orders as billingOrders } from '@/contexts/billing/infrastructure/persistence/billing.schema';",
      "export { orders } from './legacy.mjs';",
    ]);
  });
});

describe('what a tables file re-exports from a module the kit does not follow', () => {
  it('is said by no command while no name it holds is shared, the index holding lines by name or not', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    write(root, `${persistence('billing')}/widgets.tsx`, 'export const widgets = 1;\n');

    write(
      root,
      tablesOf('billing'),
      `${read(root, tablesOf('billing'))}\nexport { default as seed } from './seed.json';\nexport type { Row } from './row.d';\nexport * from './widgets';\n`,
    );

    write(
      root,
      INDEX,
      read(root, INDEX).replace('// /ddd-ts-kit:schemas\n', "export * from './legacy.mjs';\n// /ddd-ts-kit:schemas\n"),
    );

    const said = [store(root, 'returns', 'Parcel'), store(root, 'shipping', 'Crate')];

    commitAll(root);
    said.push(expectOk(cli(root, 'init', '--force')).stdout);

    expect(said.join('\n')).not.toContain(`${INDEX}`.concat(':'));
    expect(said.join('\n')).not.toContain('is left as it stood');
  });
});
