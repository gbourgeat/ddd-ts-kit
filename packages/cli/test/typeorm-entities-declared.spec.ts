import { describe, expect, it } from 'vitest';
import { read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { forcedInit } from './support/forced-init';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';
const TABLES = `${PERSISTENCE}/billing.schema.ts`;
const SHARED_KERNEL = 'src/shared-kernel/persistence/orders.schema.ts';

const ONE_OBJECT = `import { EntitySchema } from 'typeorm';

/** The one table of orders two contexts re-export. */
export const orders = new EntitySchema({ name: 'SharedOrder', tableName: 'orders', columns: { id: { type: 'text', primary: true } } });
`;

/** Rewrites the tables file of billing, which holds the table `orders` as generated, the way a team may write it. */
type Shape = (root: string) => void;

/** The tables moved to `billing-tables.ts` beside the tables file, which then holds `content`, with more files. */
function movedBehind(content: string, more: Readonly<Record<string, string>> = {}): Shape {
  return (root) => {
    write(root, `${PERSISTENCE}/billing-tables.ts`, read(root, TABLES));

    for (const [file, text] of Object.entries(more)) {
      write(root, `${PERSISTENCE}/${file}`, text);
    }

    write(root, TABLES, content);
  };
}

/** A chain of `count` files, each taking `orders` by name from the next, the last from the moved tables. */
function chain(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_unused, at) => [
      `link-${at}.ts`,
      `export { orders } from './${at + 1 === count ? 'billing-tables' : `link-${at + 1}`}';\n`,
    ]),
  );
}

/** What the 25th review found the reader could not follow, or took for a declaration: none is one. */
const NOT_DECLARED: Readonly<Record<string, Shape>> = {
  '1a, a file beside a folder of one name': movedBehind("export { orders } from './billing-tables';\n", {
    'billing-tables/index.ts': "export const orders = 'a folder of the same name';\n",
  }),
  '1b, a path of tsconfig the kit does not know': movedBehind("export { orders } from '~legacy/billing-tables';\n"),
  '1d, a package through a subpath': movedBehind("export { orders } from '@acme/tables/orders';\n"),
  '1e, a chain past the depth the reader follows': movedBehind("export { orders } from './link-0';\n", chain(10)),
  '1f, a missing module': movedBehind("export { orders } from './missing';\n"),
  '1f, a cycle': movedBehind("export { orders } from './cycle';\n", {
    'cycle.ts': "export { orders } from './billing.schema';\n",
  }),
  '2, a renamed local export': (root) => {
    write(
      root,
      TABLES,
      `${read(root, TABLES).replace(/^export const orders = /m, 'const held = ')}\nexport { held as orders };\n`,
    );
  },
  'KK1 (1), a constant built by `new` inside a function, the export an alias': (root) => {
    const aliased = read(root, TABLES).replace(/^export const orders = /m, 'const sharedOrders = ');

    write(
      root,
      TABLES,
      `${aliased}\nfunction shadowed(): Date {\n  void 0;\n  const orders = new Date();\n\n  return orders;\n}\n\nexport const orders = sharedOrders;\nexport const shadow = shadowed;\n`,
    );
  },
  'KK1 (2), an unexported constant beside a renamed export from a module the kit does not resolve': movedBehind(
    "const orders = new Date();\n\nexport { held as orders } from './missing-held';\n",
  ),
  '2, a constant alias of another binding': movedBehind(
    "import { orders as moved } from './billing-tables';\n\nexport const orders = moved;\n",
  ),
};

describe('merge-trunk on TypeORM, a tables file that does not declare the name itself', () => {
  it.each(Object.entries(NOT_DECLARED))(
    '%s: nothing is written for the name, and the merge says why',
    async (_shape, shape) => {
      const root = twoSides({
        orm: 'typeorm',
        trunk: (project) => {
          store(project, 'billing', 'Order');
          shape(project);
        },
        branch: (project) => void store(project, 'shipping', 'Order'),
      });

      const main = asMainLeavesIt(root);
      const merged = mergeTrunk(root);
      const loaded = await loadedIndex(root);

      expect(merged.stdout).toContain(
        `imports \`orders\` twice and the kit cannot tell the entities apart: '${TABLES}' does not declare \`orders\` itself; the kit wrote nothing for it: import each entity from the tables file that declares it.`,
      );

      expect(merged.stdout).not.toContain('imported two entities');
      expect(read(root, INDEX)).toBe(main);
      expect(loaded.twice).toEqual([]);
    },
  );
});

describe('merge-trunk on TypeORM, tables files written without semicolons', () => {
  it('KK2: each declares its table itself: the name is settled', async () => {
    const withoutSemicolons = (project: string, context: string): void => {
      const file = `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;

      write(project, file, read(project, file).replace(/;$/gm, ''));
    };

    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => {
        store(project, 'billing', 'Order');
        withoutSemicolons(project, 'billing');
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        withoutSemicolons(project, 'shipping');
      },
    });

    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain('is now imported as `shippingOrders`');
    expect(merged.stdout).not.toContain('does not declare');

    expect({ error: loaded.error, twice: loaded.twice, missing: loaded.missing }).toEqual({
      error: undefined,
      twice: [],
      missing: [],
    });
  });
});

describe('merge-trunk on TypeORM, a table declared at the top level, then listed by its name', () => {
  it('is declared by its tables file itself: the name is settled', async () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => {
        store(project, 'billing', 'Order');

        write(
          project,
          TABLES,
          `${read(project, TABLES).replace(/^export const orders = /m, 'const orders = ')}\nexport { orders };\n`,
        );
      },
      branch: (project) => void store(project, 'shipping', 'Order'),
    });

    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain('is now imported as `shippingOrders`');

    expect({ error: loaded.error, twice: loaded.twice, missing: loaded.missing }).toEqual({
      error: undefined,
      twice: [],
      missing: [],
    });
  });
});

/** Both tables files re-export the one table of the shared kernel, the index naming each its own way. */
function reexportedByBoth(project: string): void {
  write(project, SHARED_KERNEL, ONE_OBJECT);
  store(project, 'billing', 'Order');
  store(project, 'shipping', 'Order');

  for (const context of ['billing', 'shipping']) {
    write(
      project,
      `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`,
      "export { orders } from '@/shared-kernel/persistence/orders.schema';\n",
    );
  }
}

describe('one object two tables files re-export, imported under two names (the 25th review, 3)', () => {
  it('init --force writes nothing, says nothing of it, and exits as main', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    reexportedByBoth(root);

    const before = read(root, INDEX);
    const forced = forcedInit(root);

    expect(before).toContain('orders as shippingOrders');
    expect(forced.code).toBe(0);
    expect(read(root, INDEX)).toBe(before);
    expect(forced.stdout).not.toMatch(/listed once|put the index back|left as it stood|exit/);
  });

  it('a merge that brings it writes nothing for it', () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: reexportedByBoth,
      branch: (project) => void store(project, 'returns', 'Parcel'),
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);

    expect(merged.code, merged.stdout).toBe(0);
    expect(read(root, INDEX)).toBe(main);
    expect(merged.stdout).not.toMatch(/listed once|put the index back|is now imported as/);
  });
});
