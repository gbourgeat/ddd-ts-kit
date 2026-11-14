import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { goOn, merging, mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;

const BY_HAND = [
  `export { orders } from ${from('billing')}`,
  `export { orders as shippingOrders } from ${from('shipping')}`,
];

/** What a command says of an index it could not write: the lines to write by hand, once, and no line it did not write. */
function expectToldByHand(root: string, said: string): void {
  expect(said).not.toMatch(/lists the (?:table|type)/);
  expect(said.match(/the kit wrote no name in it|is left as it stood before the command/g)).toHaveLength(1);
  BY_HAND.forEach((line) => expect(said).toContain(line));
  expect(read(root, INDEX)).not.toMatch(/^export \{/m);
}

describe('what a command says of the names of the schema index is what it wrote', () => {
  it('gives the lines to write by hand when generate cannot write the index', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    expectOk(cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', 'Order=What shipping sends'));
    fs.chmodSync(path.join(root, INDEX), 0o444);

    const generated = cli(root, 'generate', 'repository', 'shipping', 'Order');

    expectToldByHand(root, generated.stdout);
  });

  it('gives the lines to write by hand when the index holds no region to write them in', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    write(root, INDEX, read(root, INDEX).replace(/^\/\/ \/?ddd-ts-kit:schemas\n/gm, ''));
    store(root, 'shipping', 'Order');
    write(root, INDEX, `${read(root, INDEX)}export * from ${from('shipping')}\n`);

    const said = expectOk(cli(root, 'generate', 'read-model', 'returns', 'Refunds')).stdout;

    expectToldByHand(root, said);
  });

  it('gives the lines to write by hand when merge-trunk --continue cannot write the index', () => {
    const root = twoSides({
      orm: 'drizzle',
      trunk: (project) => {
        store(project, 'billing', 'Order');
        write(project, 'notes.md', 'What the trunk noted.\n');
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        write(project, 'notes.md', 'What the branch noted.\n');
      },
    });

    const both = `// ddd-ts-kit:schemas\nexport * from ${from('billing')}\nexport * from ${from('shipping')}\n// /ddd-ts-kit:schemas\n`;

    mergeTrunk(root);
    expect(merging(root)).toBe(true);
    write(root, 'notes.md', 'What both noted.\n');
    write(root, INDEX, read(root, INDEX).replace(/\/\/ ddd-ts-kit:schemas\n[\s\S]*\/\/ \/ddd-ts-kit:schemas\n/, both));
    git(root, 'add', 'notes.md', INDEX);
    fs.chmodSync(path.join(root, INDEX), 0o444);

    const continued = goOn(root, '--continue');

    expect(continued.code, continued.stderr).toBe(0);
    expectToldByHand(root, continued.stdout);
  });

  it('says nothing of an index that re-exports another module of the project while no name is shared, and settles one that is', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const extra = "export * from '@/extra';\n";

    write(root, 'src/extra.ts', 'export const extra = 1;\n');
    write(root, INDEX, read(root, INDEX).replace('// ddd-ts-kit:schemas\n', `// ddd-ts-kit:schemas\n${extra}`));

    const quiet = [store(root, 'billing', 'Order'), store(root, 'shipping', 'Parcel')].join('\n');
    const shared = store(root, 'shipping', 'Order');

    expect(quiet).not.toContain(INDEX.concat(':'));
    expect(shared).toContain('lists the name `orders` of shipping as `shippingOrders`');
    BY_HAND.forEach((line) => expect(read(root, INDEX)).toContain(line));
  });

  it('says once what to write when the index re-exports a package whole and a name is shared', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);
    const extra = "export * from '@acme/extra';\n";

    write(root, INDEX, read(root, INDEX).replace('// ddd-ts-kit:schemas\n', `// ddd-ts-kit:schemas\n${extra}`));

    const quiet = [store(root, 'billing', 'Order'), store(root, 'shipping', 'Parcel')].join('\n');

    expectOk(cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', 'Order=What shipping sends'));

    const shared = cli(root, 'generate', 'repository', 'shipping', 'Order');

    expect(quiet).not.toContain(INDEX.concat(':'));
    expect(shared.code).toBe(3);
    expectToldByHand(root, shared.stdout);
    // The `export *` line of shipping stood already: nothing says its tables are listed nowhere.
    expect(shared.stdout).not.toContain('are listed nowhere');
    expect(shared.stdout).not.toContain(`updated      ${INDEX}`);
  });
});

describe('merge-trunk on TypeORM, each side having settled one name its own way', () => {
  it('lists each entity once, and leaves the names of the trunk as the trunk wrote them', async () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => ['billing', 'shipping'].forEach((context) => store(project, context, 'Order')),
      branch: (project) => ['shipping', 'returns', 'billing'].forEach((context) => store(project, context, 'Order')),
    });

    const onTrunk = git(root, 'show', `main:${INDEX}`).match(/^import \{ .*orders.* \} from .*$/gim) ?? [];
    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.code, merged.stderr).toBe(0);
    expect(merged.stdout).toContain('it keeps `shippingOrders`, the name the trunk gives it, and is listed once');

    expect({ error: loaded.error, missing: loaded.missing, twice: loaded.twice }).toEqual({
      error: undefined,
      missing: [],
      twice: [],
    });

    expect(loaded.tables.filter((table) => table.endsWith('.orders'))).toEqual([
      'billing.orders',
      'returns.orders',
      'shipping.orders',
    ]);

    expect(onTrunk).toHaveLength(2);
    onTrunk.forEach((line) => expect(read(root, INDEX)).toContain(line));
  });
});
