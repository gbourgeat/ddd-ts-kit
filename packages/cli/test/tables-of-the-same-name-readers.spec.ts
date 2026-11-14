import { describe, expect, it } from 'vitest';
import { listedInIndex, namedBindingsOf, warnDroppedContextTables } from '../src/migration';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { committedProject } from './support/committed-project';
import { expectOk } from './support/expect-ok';
import { git } from './support/git';
import { jsonAt } from './support/json-at';
import {
  CONTEXTS,
  emptied,
  INDEX,
  regionIn,
  regionOf,
  sourceOf,
  storeParcel,
  twoContextsOn,
} from './support/same-name-project';

describe('init --force, on tables of the same name in two contexts on Drizzle', () => {
  it('settles with init --force an index an earlier version left with both tables under one name', () => {
    const root = twoContextsOn('drizzle');

    write(
      root,
      INDEX,
      read(root, INDEX)
        .split('\n')
        .filter((line) => !line.startsWith('export {'))
        .join('\n'),
    );

    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      `export { invoiceSummaries } from '${sourceOf('billing')}';`,
      `export { invoiceSummaries as shippingInvoiceSummaries } from '${sourceOf('shipping')}';`,
      `export { parcels } from '${sourceOf('billing')}';`,
      `export { parcels as shippingParcels } from '${sourceOf('shipping')}';`,
    ]);
  });

  it('keeps with init --force the name another context already holds by name, and names the one listed first', () => {
    const root = twoContextsOn('drizzle');
    const byHand = `export { parcels } from '${sourceOf('shipping')}';`;

    write(
      root,
      INDEX,
      read(root, INDEX)
        .split('\n')
        .filter((line) => !line.startsWith('export {'))
        .join('\n')
        .replace('// /ddd-ts-kit:schemas', `${byHand}\n// /ddd-ts-kit:schemas`),
    );

    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(regionOf(root, 'schemas').slice(2)).toEqual([
      byHand,
      `export { invoiceSummaries } from '${sourceOf('billing')}';`,
      `export { invoiceSummaries as shippingInvoiceSummaries } from '${sourceOf('shipping')}';`,
      `export { parcels as billingParcels } from '${sourceOf('billing')}';`,
    ]);
  });

  it('writes the same index again when init --force finds its regions emptied', () => {
    const root = twoContextsOn('drizzle');

    commitAll(root);
    write(root, INDEX, emptied(read(root, INDEX), 'schemas'));
    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(git(root, 'diff', 'HEAD~1', '--', INDEX)).toBe('');
  });
});

describe('init --force, on tables of the same name in two contexts on TypeORM', () => {
  it('writes the same index again when init --force finds its regions emptied, or the entry of an entity lost', () => {
    const root = twoContextsOn('typeorm');

    commitAll(root);

    const generated = read(root, INDEX);

    write(root, INDEX, emptied(emptied(generated, 'imports'), 'schemas'));
    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(read(root, INDEX)).toBe(generated);

    write(root, INDEX, generated.replace('  shippingParcels,\n', ''));
    commitAll(root);
    expectOk(cli(root, 'init', '--force'));

    expect(regionOf(root, 'imports')).toEqual(regionIn(generated, 'imports'));
    expect(regionOf(root, 'schemas')).toContain('shippingParcels,');
  });
});

describe('typeorm-generate, on tables of the same name in two contexts', () => {
  it('says that a migration would drop the table of the second context while the index names the first alone', () => {
    const root = twoContextsOn('typeorm');
    const lines: string[] = [];

    write(
      root,
      'migrations/1700000000000-init.ts',
      'await queryRunner.query(`CREATE TABLE "shipping"."parcels" ("id" text)`);\n',
    );

    const warned = (): string => {
      lines.length = 0;
      warnDroppedContextTables(root, { out: () => undefined, err: (text) => lines.push(text) }, 'typeorm');

      return lines.join('\n');
    };

    expect(warned()).toBe('');

    write(root, INDEX, read(root, INDEX).replace('  shippingParcels,\n', ''));

    expect(warned()).toContain('drops the tables of the context shipping (shipping.parcels)');

    write(
      root,
      INDEX,
      emptied(read(root, INDEX), 'imports').replace(
        '// /ddd-ts-kit:imports',
        `import { parcels } from '${sourceOf('billing')}';\n// /ddd-ts-kit:imports`,
      ),
    );

    expect(warned()).toContain('drops the tables of the context shipping (shipping.parcels)');
  });
});

describe('what a schema index lists', () => {
  const file = 'shipping.schema';

  it('reads an entity under the name its import gives it', () => {
    const index = `import { orders as shippingOrders } from '${sourceOf('shipping')}';\nexport const entities = [shippingOrders];\n`;

    expect(listedInIndex(index, { file, constant: 'orders' })).toBe(true);
    expect(listedInIndex(index.replace('[shippingOrders]', '[]'), { file, constant: 'orders' })).toBe(false);
  });

  it('does not take the table of the same name of another context for this one', () => {
    const index = `import { orders } from '${sourceOf('billing')}';\nexport const entities = [orders];\n`;

    expect(listedInIndex(index, { file, constant: 'orders' })).toBe(false);
    expect(listedInIndex(index, { file: 'billing.schema', constant: 'orders' })).toBe(true);
  });

  it('still reads a constant the index takes from elsewhere than a tables file, or declares itself', () => {
    expect(
      listedInIndex("import { orders } from '@/contexts/shipping';\nexport const entities = [orders];\n", {
        file,
        constant: 'orders',
      }),
    ).toBe(true);

    expect(listedInIndex('export const entities = [];\n', { file })).toBe(false);
  });

  it('reads the names of an import or of an export, their aliases and their types, comments left out', () => {
    const text = [
      "import type { Row, Columns as Held } from './row';",
      "// import { ghost } from './ghost';",
      "export { orders, parcels as shippingParcels } from './shipping.schema';",
      'export { local };',
    ].join('\n');

    expect(namedBindingsOf(text, 'import')).toEqual([
      {
        source: './row',
        names: [
          { name: 'Row', local: 'Row' },
          { name: 'Columns', local: 'Held' },
        ],
      },
    ]);

    expect(namedBindingsOf(text, 'export')).toEqual([
      {
        source: './shipping.schema',
        names: [
          { name: 'orders', local: 'orders' },
          { name: 'parcels', local: 'shippingParcels' },
        ],
      },
    ]);
  });
});

describe('verify-slice, on the index of a slice that stores a table another context holds', () => {
  it.each(['drizzle', 'typeorm'])('stages the index on %s: each changed line names what the context exports', (orm) => {
    const root = committedProject(`same-name-${orm}`, ...CONTEXTS, '--package-manager', 'npm', '--orm', orm);
    const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

    manifest.scripts['regenerate'] = 'node -e ""';
    manifest.scripts['test'] = 'node -e ""';
    write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
    storeParcel(root, 'billing');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'feat(billing): store');
    git(root, 'switch', '--quiet', '--create', 'build/shipping');
    storeParcel(root, 'shipping');

    const verification = cli(root, 'verify-slice', 'shipping', '--since', 'main', '--json').json();

    expect(jsonAt(verification, 'toStage')).toEqual(expect.arrayContaining([INDEX]));
    expect(jsonAt(verification, 'leftOut')).toEqual([]);
  });
});
