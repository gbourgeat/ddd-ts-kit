import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { lineTheKitDidNotWrite } from '../src/generate/kinds/same-name/line-the-kit-did-not-write';
import { Workspace } from '../src/workspace';
import { read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { forcedInit } from './support/forced-init';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { initProject } from './support/init-project';
import { loadedIndex } from './support/index-tables';
import { notWritten } from './support/not-written';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const SHIPPING = "'@/contexts/shipping/infrastructure/persistence/shipping.schema'";

function appended(project: string, ...lines: string[]): void {
  write(project, INDEX, `${read(project, INDEX)}${lines.join('\n')}\n`);
}

/** Writes a line at the end of a region of the kit, before its closing marker. */
function inRegion(project: string, region: string, line: string): void {
  const closing = region === 'schemas' ? `  // /ddd-ts-kit:${region}` : `// /ddd-ts-kit:${region}`;

  write(project, INDEX, read(project, INDEX).replace(closing, `${line}\n${closing}`));
}

describe('merge-trunk on TypeORM, any line of the index the kit did not write keeps it from renaming an entity', () => {
  it.each([
    {
      what: 'a spread',
      edit: (project: string) =>
        appended(project, 'export const shippingOrderOptions = { ...orders.options, name: "archived_orders" };'),
      quoted: 'export const shippingOrderOptions = { ...orders.options, name: "archived_orders" };',
    },
    {
      what: 'a read after a division the lexer takes for a regular expression',
      edit: (project: string) =>
        appended(project, 'export const ratio = (globalThis as { k?: number }).k! / orders.options.name.length / 2;'),
      quoted: 'export const ratio = (globalThis as { k?: number }).k! / orders.options.name.length / 2;',
    },
    {
      what: 'a regular expression after `)` that holds a backtick',
      edit: (project: string) =>
        appended(project, 'export const quoted = String(orders.options.name).replace(/`/g, "");'),
      quoted: 'export const quoted = String(orders.options.name).replace(/`/g, "");',
    },
    {
      what: 'a name written with a unicode escape',
      edit: (project: string) => appended(project, 'export const escaped = [\\u006frders];'),
      quoted: 'export const escaped = [\\u006frders];',
    },
    {
      what: 'an import without its semicolon',
      edit: (project: string) =>
        appended(project, "import { inspect } from 'node:util'", 'export const shown = inspect(orders);'),
      quoted: "import { inspect } from 'node:util'",
    },
    {
      what: 'a dynamic import',
      edit: (project: string) => appended(project, "export const later = import('node:util').then(() => orders);"),
      quoted: "export const later = import('node:util').then(() => orders);",
    },
    {
      what: 'a line the lexer is uncertain of, in the region of the imports',
      edit: (project: string) => inRegion(project, 'imports', 'const pattern = /`/;'),
      quoted: 'const pattern = /`/;',
    },
    {
      what: 'an import without its semicolon, in the region of the imports',
      edit: (project: string) => inRegion(project, 'imports', `import { orders as legacyOrders } from ${SHIPPING}`),
      quoted: `import { orders as legacyOrders } from ${SHIPPING}`,
    },
    {
      what: 'an entry written by hand in the region of the entities',
      edit: (project: string) => inRegion(project, 'schemas', '  ...[orders],'),
      quoted: '...[orders],',
    },
  ])('$what: nothing is written, and the merge quotes the line', async ({ edit, quoted }) => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        edit(project);
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain(notWritten(read(root, INDEX), quoted));
    expect(merged.stdout.match(/the kit wrote nothing for the entities/g)).toHaveLength(1);
    expect(merged.stdout).not.toContain('`shippingOrders`');
    expect(read(root, INDEX)).toBe(main);
    expect(loaded.error).toBeDefined();
  });

  it('an entity imported under two names is not listed once while a line the kit did not write is in the index', () => {
    const spread = 'export const shippingOrderOptions = { ...orders.options, name: "archived_orders" };';

    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => {
        store(project, 'billing', 'Order');
        store(project, 'shipping', 'Order');
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        appended(project, spread);
      },
    });

    const merged = mergeTrunk(root);

    // As main leaves it: the lines of both sides, the import of shipping under both of its names.
    expect(merged.stdout).not.toContain('is listed once');
    expect(merged.stdout).toContain(notWritten(read(root, INDEX), spread));
    expect(read(root, INDEX)).toContain(`import { orders, orders as shippingOrders } from ${SHIPPING};`);
    expect(read(root, INDEX)).toMatch(/^ {2}orders,\n {2}shippingOrders,$/m);
  });
});

describe('merge-trunk on TypeORM, an index the kit wrote whole', () => {
  it.each([
    [],
    ['--event-sourcing', 'on'],
    ['--audit', 'on'],
    ['--tenancy', 'shared-table', '--event-sourcing', 'on', '--audit', 'on', '--privacy', 'on', '--queue', 'database'],
  ])('still settles, and what it leaves is an index the kit wrote whole (%s)', async (...flags) => {
    const root = twoSides({
      orm: 'typeorm',
      flags: flags.flat(),
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => void store(project, 'shipping', 'Order'),
    });

    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);
    const { config } = readConfig(root);

    expect(merged.code, merged.stdout).toBe(0);
    expect(merged.stdout).not.toContain('the kit wrote nothing for the entities');
    expect(read(root, INDEX)).toMatch(/orders as shippingOrders/);
    expect({ error: loaded.error, twice: loaded.twice }).toEqual({ error: undefined, twice: [] });
    expect(lineTheKitDidNotWrite(new Workspace(root, false), config, read(root, INDEX))).toBeUndefined();
  });

  it('nothing to settle: a name read by a line of the team is no reason to say anything', () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Invoice');

        appended(
          project,
          `import { invoices as invoiceView } from ${SHIPPING};`,
          'export const nameOk = /^[a-z_]+$/.test(invoiceView.options.name);',
        );
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root, '--json');

    // As main answers: the index is merged as a registry, and nothing more is said of it.
    expect(merged.code, merged.stdout).toBe(0);

    expect(merged.json()).toMatchObject({
      automatic: [{ file: INDEX, kind: 'registry', how: 'generated registry: the lines of both sides kept' }],
      leftOut: [],
    });

    expect(merged.stdout).not.toContain('the kit wrote');
    expect(read(root, INDEX)).toBe(main);
  });
});

describe('init --force on TypeORM, an index that holds a line the kit did not write', () => {
  it('writes nothing for the entities, and quotes the line', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    inRegion(root, 'schemas', '  ...[orders],');

    const forced = forcedInit(root);

    expect(forced.stdout).toContain(notWritten(read(root, INDEX), '...[orders],'));
    expect(read(root, INDEX)).not.toContain('shippingOrders');
  });

  it('settles an index the kit wrote whole', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');

    write(
      root,
      INDEX,
      read(root, INDEX).replace('orders as shippingOrders', 'orders').replace('  shippingOrders,\n', ''),
    );

    const forced = forcedInit(root);

    expect(forced.stdout).toContain('is now imported as `shippingOrders`');
  });
});

describe('generate on TypeORM, an index that holds a line the kit did not write', () => {
  it('only adds: the new import takes a name of its own, and nothing is said of the line', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');
    appended(root, 'export const legacy = [orders];');

    const said = store(root, 'shipping', 'Order');

    expect(said).not.toContain('the kit wrote nothing');
    expect(read(root, INDEX)).toContain('orders as shippingOrders');
    expect(read(root, INDEX)).toContain('export const legacy = [orders];');
  });
});
