import { describe, expect, it } from 'vitest';
import { read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { forcedInit } from './support/forced-init';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const PERSISTENCE = (context: string, from: string): string =>
  `'${from}contexts/${context}/infrastructure/persistence/${context}.schema'`;

const A = `import { orders } from ${PERSISTENCE('shipping', '@/')};`;
const A_AGAIN = `import { orders } from ${PERSISTENCE('shipping', '../../')};`;
const B = `import { orders } from ${PERSISTENCE('billing', '@/')};`;
const C = `import { orders } from ${PERSISTENCE('returns', '@/')};`;
const PARCELS = `import { parcels } from ${PERSISTENCE('shipping', '@/')};`;

/** Writes the two regions of the index as given, one line each. */
function regions(root: string, imports: readonly string[], entries: readonly string[]): void {
  const index = read(root, INDEX)
    .replace(
      /(\/\/ ddd-ts-kit:imports\n)[\s\S]*?(\/\/ \/ddd-ts-kit:imports)/,
      `$1${imports.map((line) => `${line}\n`).join('')}$2`,
    )
    .replace(
      /(\/\/ ddd-ts-kit:schemas\n)[\s\S]*?( {2}\/\/ \/ddd-ts-kit:schemas)/,
      `$1${entries.map((entry) => `  ${entry},\n`).join('')}$2`,
    );

  write(root, INDEX, index);
}

function importsOf(index: string): string {
  return /\/\/ ddd-ts-kit:imports\n([\s\S]*?)\/\/ \/ddd-ts-kit:imports/.exec(index)?.[1] ?? '';
}

/** Never an entity listed twice, never an alias the kit gave shipping or billing (returns is the one a generator aliases). */
async function expectNoEntityTwice(root: string): Promise<void> {
  const loaded = await loadedIndex(root);

  expect(loaded.twice).toEqual([]);
  expect(read(root, INDEX)).not.toMatch(/orders as (shipping|billing|shippingContext)Orders/);
}

function projectWithFourTables(): string {
  const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

  store(root, 'shipping', 'Order');
  store(root, 'shipping', 'Parcel');
  store(root, 'billing', 'Order');
  store(root, 'returns', 'Order');

  return root;
}

describe('init --force on TypeORM, a name the region imports three times', () => {
  it.each([
    [
      'B, A, A through another specifier of the file',
      [B, A, A_AGAIN],
      'billing, `orders` of shipping, `orders` of shipping',
    ],
    ['B, A, A through the same specifier', [B, A, A], 'billing, `orders` of shipping, `orders` of shipping'],
    ['A, A, B', [A, A_AGAIN, B], 'shipping, `orders` of shipping, `orders` of billing'],
    ['A, B, A', [A, B, A_AGAIN], 'shipping, `orders` of billing, `orders` of shipping'],
    ['A, B, C, three entities', [A, B, C], 'shipping, `orders` of billing, `orders` of returns'],
  ])('%s: the kit writes nothing for the name, and says what the index holds', async (_shape, imports, which) => {
    const root = projectWithFourTables();

    regions(root, [...imports, PARCELS], ['orders', 'parcels']);

    const held = importsOf(read(root, INDEX));
    const forced = forcedInit(root);

    expect(forced.stdout).toContain(
      `${INDEX}: imports \`orders\` 3 times (\`orders\` of ${which}) and lists it once; the kit wrote nothing for it: keep one import of each entity, each under its own name, and list each name once.`,
    );

    expect(forced.stdout).not.toContain('imported two entities');
    expect(importsOf(read(root, INDEX))).toContain(held);
    await expectNoEntityTwice(root);
  });
});

describe('merge-trunk on TypeORM, a merged region that imports one name three times', () => {
  it('B, A, A: writes nothing for the name, and never lists an entity twice', async () => {
    const root = twoSides({
      orm: 'typeorm',
      base: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'shipping', 'Parcel');
      },
      trunk: (project) => void store(project, 'returns', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        regions(project, [B, PARCELS, A, A_AGAIN], ['orders', 'parcels']);
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain(
      'imports `orders` 3 times (`orders` of billing, `orders` of shipping, `orders` of shipping) and lists it once; the kit wrote nothing for it',
    );

    expect(read(root, INDEX)).toBe(main);
    await expectNoEntityTwice(root);
  });

  it('B, A, A through the same specifier: the merge keeps the line once, and the two entities are told apart', async () => {
    const root = twoSides({
      orm: 'typeorm',
      base: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'shipping', 'Parcel');
      },
      trunk: (project) => void store(project, 'returns', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        regions(project, [B, PARCELS, A, A], ['orders', 'parcels']);
      },
    });

    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain('`orders` of shipping is now imported as `shippingOrders`');
    expect({ error: loaded.error, twice: loaded.twice }).toEqual({ error: undefined, twice: [] });
  });

  it('L1: two entries of one name for two entities, each side at its own place: nothing written for the name', async () => {
    const root = twoSides({
      orm: 'typeorm',
      base: (project) => void store(project, 'shipping', 'Parcel'),
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        write(project, INDEX, read(project, INDEX).replace('  parcels,\n  orders,\n', '  orders,\n  parcels,\n'));
      },
    });

    const merged = mergeTrunk(root);

    expect(read(root, INDEX).match(/^ {2}orders,$/gm)).toHaveLength(2);

    expect(merged.stdout).toMatch(
      /imports `orders` twice \(`orders` of (shipping|billing), `orders` of (shipping|billing)\) and lists it twice; the kit wrote nothing for it/,
    );

    expect(read(root, INDEX)).not.toContain('Orders,');
    await expectNoEntityTwice(root);
  });
});
