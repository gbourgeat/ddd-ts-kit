import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { settleSameEntities } from '../src/generate/kinds/same-name/settle-same-entities';
import { Workspace } from '../src/workspace';
import { cli, read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { forcedInit } from './support/forced-init';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const SHARED_KERNEL = 'src/shared-kernel/persistence/orders.schema.ts';

const ONE_OBJECT = `import { EntitySchema } from 'typeorm';

/** The one table of orders the two contexts re-export. */
export const orders = new EntitySchema({ name: 'SharedOrder', tableName: 'orders', columns: { id: { type: 'text', primary: true } } });
`;

const tablesFile = (context: string): string =>
  `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;

const SHIPPING = "'@/contexts/shipping/infrastructure/persistence/shipping.schema'";

/** Writes the two regions of the index as given, one line each. */
function regions(root: string, imports: readonly string[], entries: readonly string[]): void {
  const index = read(root, INDEX)
    .replace(
      /(\/\/ ddd-ts-kit:imports\n)[\s\S]*?(\/\/ \/ddd-ts-kit:imports)/,
      `$1${imports.map((line) => `${line}\n`).join('')}$2`,
    )
    .replace(
      /(\/\/ ddd-ts-kit:schemas\n)[\s\S]*?( {2}\/\/ \/ddd-ts-kit:schemas)/,
      `$1${entries.map((entry) => `  ${entry}\n`).join('')}$2`,
    );

  write(root, INDEX, index);
}

/** Never one object listed twice: the index does not list it under two names. */
async function expectNoObjectTwice(root: string): Promise<void> {
  const loaded = await loadedIndex(root);

  expect(loaded.twice).toEqual([]);
  expect(read(root, INDEX)).not.toMatch(/orders as (shipping|billing)Orders/);
}

describe('merge-trunk on TypeORM, one entity two tables files re-export under one name', () => {
  it('a: is not taken for two entities: the kit writes nothing for the name, and says why', async () => {
    const root = twoSides({
      orm: 'typeorm',
      base: (project) => write(project, SHARED_KERNEL, ONE_OBJECT),
      trunk: (project) => {
        store(project, 'billing', 'Order');
        write(project, tablesFile('billing'), "export { orders } from '@/shared-kernel/persistence/orders.schema';\n");
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        write(project, tablesFile('shipping'), "export { orders } from '@/shared-kernel/persistence/orders.schema';\n");
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);

    expect(merged.stdout).toMatch(
      /imports `orders` twice and the kit cannot tell the entities apart: 'src\/contexts\/(shipping|billing)\/infrastructure\/persistence\/(shipping|billing)\.schema\.ts' does not declare `orders` itself; the kit wrote nothing for it: import each entity from the tables file that declares it\./,
    );

    expect(merged.stdout).not.toContain('imported two entities');
    expect(read(root, INDEX)).toBe(main);
    await expectNoObjectTwice(root);
  });
});

describe('init --force on TypeORM, the flat tables file of a modular context re-exporting the one of shared/', () => {
  it.each([
    ['the import of shared/ first', false],
    ['the import of the flat file first', true],
  ])(
    'b, %s: is not taken for a second entity: the kit writes nothing for the name, and says why',
    async (_order, flatFirst) => {
      const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');
      const run = (...args: string[]): string => expectOk(cli(root, ...args)).stdout;
      const shared = '@/contexts/billing/shared/infrastructure/persistence/billing.schema';

      commitAll(root);
      store(root, 'billing', 'Order');
      commitAll(root);

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
      write(root, tablesFile('billing'), `export { orders } from '${shared}';\n`);

      regions(
        root,
        flatFirst
          ? [
              "import { orders } from '@/contexts/billing/infrastructure/persistence/billing.schema';",
              `import { orders } from '${shared}';`,
            ]
          : [
              `import { orders } from '${shared}';`,
              "import { orders } from '@/contexts/billing/infrastructure/persistence/billing.schema';",
            ],
        ['orders,'],
      );

      const forced = forcedInit(root);

      expect(forced.stdout).toContain(
        `${INDEX}: imports \`orders\` twice and the kit cannot tell the entities apart: '${tablesFile('billing')}' does not declare \`orders\` itself; the kit wrote nothing for it: import each entity from the tables file that declares it.`,
      );

      await expectNoObjectTwice(root);
    },
  );
});

describe('init --force on TypeORM, an entry of `entities` written with blanks around its comma', () => {
  it('is taken out with the import it lists: the index keeps compiling', async () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');

    regions(
      root,
      [
        "import { orders } from '@/contexts/billing/infrastructure/persistence/billing.schema';",
        `import { orders as shippedOrders } from ${SHIPPING};`,
        `import { orders as shippingOrders } from ${SHIPPING};`,
      ],
      ['orders,', 'shippedOrders,', 'shippingOrders ,'],
    );

    const forced = forcedInit(root);
    const loaded = await loadedIndex(root);

    expect(forced.stdout).toContain('under two names, `shippingOrders` and `shippedOrders`: it keeps `shippedOrders`');
    expect(read(root, INDEX)).not.toContain('shippingOrders');

    expect({ error: loaded.error, twice: loaded.twice, missing: loaded.missing }).toEqual({
      error: undefined,
      twice: [],
      missing: [],
    });
  });
});

/** A workspace that takes out the import of an alias and leaves its entry: a settle that would leave an entry reading nothing. */
class UnbindingWorkspace extends Workspace {
  override update(asked: string, content: string): void {
    super.update(
      asked,
      asked === INDEX ? content.replace(/^import \{ orders as shippingOrders \} from .*\n/m, '') : content,
    );
  }
}

describe('what a TypeORM settle leaves, every entry with its import', () => {
  it('puts the index back when an entry would be left without the import that gives its name', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    const before = read(root, INDEX);
    const ws = new UnbindingWorkspace(root, false);
    const said = settleSameEntities(ws, readConfig(root).config);

    expect(said).toEqual([
      `${INDEX}: the kit put the index back as it stood: what it wrote would leave \`shippingOrders\` listed in \`entities\` while no import gives that name; give each entity one import under its own name, and list each name once, by hand.`,
    ]);

    expect(ws.read(INDEX)).toBe(before);
  });
});
