import { describe, expect, it } from 'vitest';
import { entitiesList } from '../src/generate/kinds/same-name/entities-list';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { CONTEXTS, INDEX, store, unsettle } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const persistence = (context: string): string => `src/contexts/${context}/infrastructure/persistence`;
const tablesOf = (context: string): string => `${persistence(context)}/${context}.schema.ts`;
const from = (context: string): string => `'@/contexts/${context}/infrastructure/persistence/${context}.schema';`;
const LEGACY = 'src/legacy/tables.ts';

function legacyTable(constant: string, table: string): string {
  return `import { pgTable, text } from 'drizzle-orm/pg-core';\n\nexport const ${constant} = pgTable('${table}', { id: text('id').primaryKey() });\n`;
}

function starInRegion(root: string, line: string): void {
  write(root, INDEX, read(root, INDEX).replace('// /ddd-ts-kit:schemas\n', `${line}\n// /ddd-ts-kit:schemas\n`));
}

/** The branch stores Order and Crate in shipping, then writes the alias line of the kit by hand, two names on it. */
function branchWithTwoNamesOnOneLine(project: string): void {
  const alias = `export { orders as shippingOrders } from ${from('shipping')}`;

  store(project, 'shipping', 'Order');
  store(project, 'shipping', 'Crate');

  expect(read(project, INDEX)).toContain(alias);

  write(
    project,
    INDEX,
    read(project, INDEX).replace(
      alias,
      `export { orders as shippingOrders, crates as shippingCrates } from ${from('shipping')}`,
    ),
  );
}

describe('merge-trunk says what the merged index hides or renames, whether it wrote in it or not', () => {
  it('names the table of a module of the trunk that a line of the branch hides, in the dry run and in the merge', async () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => void store(project, 'billing', 'Order'),
      trunk: (project) => {
        write(project, LEGACY, legacyTable('shippingOrders', 'legacy_shipping_orders'));
        starInRegion(project, "export * from '@/legacy/tables';");
      },
      branch: branchWithTwoNamesOnOneLine,
    });

    const hidden = `\`shippingOrders\` of '${LEGACY}' is exported under no name after the merge: \`shippingOrders\` names \`orders\` of '${tablesOf('shipping')}'`;
    const renamed = `\`shippingOrders\`, which the index of the trunk exported as \`shippingOrders\` of '${LEGACY}', now names \`orders\` of '${tablesOf('shipping')}'`;
    const previewed = mergeTrunk(root, '--dry-run').stdout;
    const merged = mergeTrunk(root).stdout;

    for (const said of [previewed, merged]) {
      expect(said).toContain(hidden);
      expect(said).toContain(renamed);
    }

    expect((await loadedIndex(root)).bound).toMatchObject({ shippingOrders: 'shipping.orders' });
  });

  it('names the table of a context of the trunk that a line of the branch hides', () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => void store(project, 'billing', 'Order'),
      trunk: (project) => void store(project, 'billing', 'ShippingOrder'),
      branch: branchWithTwoNamesOnOneLine,
    });

    const merged = mergeTrunk(root).stdout;

    expect(merged).toContain(
      `\`shippingOrders\` of '${tablesOf('billing')}' is exported under no name after the merge: \`shippingOrders\` names \`orders\` of '${tablesOf('shipping')}'`,
    );

    expect(merged).toContain('`shippingOrders`, which the index of the trunk exported as `shippingOrders` of');
  });

  it('says a name of the trunk that a module the branch brings takes', () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => void store(project, 'billing', 'Order'),
      trunk: (project) => void store(project, 'billing', 'Invoice'),
      branch: (project) => {
        write(project, LEGACY, legacyTable('orders', 'legacy_orders'));
        starInRegion(project, "export * from '@/legacy/tables';");
        store(project, 'shipping', 'Parcel');
      },
    });

    const taken = `\`orders\`, which the index of the trunk exported as \`orders\` of '${tablesOf('billing')}', now names \`orders\` of '${LEGACY}'`;

    expect(read(root, INDEX)).toContain("export { orders } from '@/legacy/tables';");
    expect(mergeTrunk(root, '--dry-run').stdout).toContain(taken);
    expect(mergeTrunk(root).stdout).toContain(taken);
  });
});

describe('init --force leaves an index whose lines by hand it cannot read', () => {
  /** `init --force` on a committed project: the index is left as it stood, said once, and the command exits as for a file it could not write. */
  function expectLeft(root: string): void {
    commitAll(root);

    const before = read(root, INDEX);
    const forced = cli(root, 'init', '--force');

    expect(forced.code).toBe(3);
    expect(forced.stdout.match(/is left as it stood before the command/g)).toHaveLength(1);
    expect(forced.stdout).toContain('outside the regions the kit writes');
    expect(forced.stdout).not.toContain(`updated      ${INDEX}`);
    expect(read(root, INDEX)).toBe(before);
  }

  it('on Drizzle, a name exported through a pattern after the region', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    store(root, 'returns', 'Order');
    unsettle(root);

    write(
      root,
      INDEX,
      `${read(root, INDEX)}import * as returnsTables from ${from('returns')}\nexport const { orders } = returnsTables;\n`,
    );

    expectLeft(root);
  });

  it('on Drizzle, a module re-exported whole after the region that the kit does not follow', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    write(root, 'src/legacy/more.mts', legacyTable('more', 'more'));
    write(root, INDEX, `${read(root, INDEX)}export * from '@/legacy/more.mjs';\n`);

    expectLeft(root);
  });

  it('on TypeORM, a spread a team added to the list of the entities', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace('export const entities', 'const more: EntitySchema[] = [];\n\nexport const entities')
        .replace('  // ddd-ts-kit:schemas\n', '  ...more,\n  // ddd-ts-kit:schemas\n'),
    );

    expectLeft(root);
  });

  it('on TypeORM, an entry after a comment that holds a bracket', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace('export const entities', 'const legacy = outbox;\n\nexport const entities')
        .replace('  outbox,\n', '  outbox, // see [docs], note\n  legacy,\n'),
    );

    expectLeft(root);
  });
});

describe('init --force and the list of the entities of a TypeORM index', () => {
  it('rewrites an index whose list holds an entry a function of the kit builds: a template of another stack wrote it', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS);

    store(root, 'billing', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .replace(
          'export const entities',
          "export const moreJobs = jobEntity({ schema: 'more' });\n\nexport const entities",
        )
        .replace('  // ddd-ts-kit:schemas\n', '  moreJobs,\n  // ddd-ts-kit:schemas\n'),
    );

    commitAll(root);

    const forced = cli(root, 'init', '--force');

    expect(forced.code, forced.stdout).toBe(0);
    expect(forced.stdout).not.toContain('is left as it stood');
    expect(read(root, INDEX)).not.toContain('moreJobs');
  });

  it('reads no entry in an index that holds no list', () => {
    expect(entitiesList('export const tables = 1;\n')).toEqual([]);
  });
});

describe('a generation that cannot keep what the index gave', () => {
  it('refuses, before it writes anything, a table whose name the tables file already exports from another file', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'shipping', 'Parcel');
    write(root, `${persistence('shipping')}/orders.table.ts`, legacyTable('orders', 'old_orders'));
    write(root, tablesOf('shipping'), `${read(root, tablesOf('shipping'))}\nexport * from './orders.table';\n`);
    cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', 'Order=What shipping sends');

    const tables = read(root, tablesOf('shipping'));
    const index = read(root, INDEX);
    const refused = cli(root, 'generate', 'repository', 'shipping', 'Order');

    expect(refused.code).not.toBe(0);

    expect(`${refused.stdout}${refused.stderr}`).toContain(
      `${tablesOf('shipping')} already exports \`orders\`, from ${persistence('shipping')}/orders.table.ts`,
    );

    expect(read(root, tablesOf('shipping'))).toBe(tables);
    expect(read(root, INDEX)).toBe(index);
  });

  it('leaves the index as it stood, says it once with what it costs, and exits as for a file it could not write', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    store(root, 'billing', 'Order');
    write(root, tablesOf('billing'), `${read(root, tablesOf('billing'))}\nexport const one = 1,\n  two = 2;\n`);
    cli(root, 'generate', 'aggregate', 'shipping', 'Order', '--term', 'Order=What shipping sends');

    const index = read(root, INDEX);
    const generated = cli(root, 'generate', 'repository', 'shipping', 'Order');
    const notes = generated.stdout.split('\n').filter((line) => line.startsWith(`note: ${INDEX}`));

    expect(generated.code).toBe(3);
    expect(notes).toHaveLength(1);
    expect(generated.stdout).not.toContain(`updated      ${INDEX}`);
    expect(generated.stdout).toContain(`  export * from ${from('shipping')}`);
    expect(generated.stdout).toContain(`  export { orders as shippingOrders } from ${from('shipping')}`);

    expect(generated.stdout).toContain(
      'Until these lines are written, the tables of shipping are listed nowhere: no migration will create them.',
    );

    expect(read(root, INDEX)).toBe(index);
  });
});
