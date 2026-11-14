import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { lineTheKitDidNotWrite } from '../src/generate/kinds/same-name/line-the-kit-did-not-write';
import { Workspace } from '../src/workspace';
import { read, write } from './helpers';
import { asMainLeavesIt } from './support/as-main-leaves-it';
import { forcedInit } from './support/forced-init';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';
import { notWritten } from './support/not-written';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const ALIASED = "'@/contexts/shipping/infrastructure/persistence/shipping.schema'";
const RELATIVE = "'../../contexts/shipping/infrastructure/persistence/shipping.schema'";

const ONE_ENTITY =
  'imports the entity `orders` of shipping twice under one name; the kit wrote nothing for it: take out one of the two imports.';

/** Writes a line at the end of a region of the kit, before its closing marker. */
function inRegion(project: string, region: string, line: string): void {
  const closing = region === 'schemas' ? `  // /ddd-ts-kit:${region}` : `// /ddd-ts-kit:${region}`;

  write(project, INDEX, read(project, INDEX).replace(closing, `${line}\n${closing}`));
}

describe('init --force on TypeORM, one entity imported twice under one name', () => {
  it.each([
    ['through another specifier of the same file', RELATIVE],
    ['through the same specifier', ALIASED],
  ])('%s: the kit writes nothing for it, and never lists it twice', async (_how, source) => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'shipping', 'Order');
    inRegion(root, 'imports', `import { orders } from ${source};`);

    const forced = forcedInit(root);
    const loaded = await loadedIndex(root);

    expect(forced.stdout).toContain(`${INDEX}: ${ONE_ENTITY}`);
    expect(forced.stdout).not.toContain('imported two entities');
    expect(read(root, INDEX)).not.toContain('shippingOrders');
    expect(read(root, INDEX).match(/^ {2}orders,$/gm)).toHaveLength(1);
    expect(loaded.twice).toEqual([]);
  });
});

describe('merge-trunk on TypeORM, a merged region that imports one entity twice under one name', () => {
  it('writes nothing for it, and never lists it twice', async () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => void store(project, 'shipping', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        write(project, INDEX, read(project, INDEX).replace(`from ${ALIASED};`, `from ${RELATIVE};`));
      },
    });

    const main = asMainLeavesIt(root);
    const merged = mergeTrunk(root);
    const loaded = await loadedIndex(root);

    expect(merged.stdout).toContain(ONE_ENTITY);
    expect(merged.stdout).not.toContain('imported two entities');
    expect(read(root, INDEX)).toBe(main);
    expect(read(root, INDEX)).not.toContain('shippingOrders');
    expect(loaded.twice).toEqual([]);
  });
});

describe('merge-trunk on TypeORM, the line the kit did not write that it quotes', () => {
  it('is the lowest of the index, in a region or outside', () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => {
        store(project, 'shipping', 'Order');
        inRegion(project, 'schemas', '  ...[orders],');
        write(project, INDEX, `${read(project, INDEX)}export const legacy = [orders];\n`);
      },
    });

    const merged = mergeTrunk(root);

    expect(merged.stdout).toContain(notWritten(read(root, INDEX), '...[orders],'));
    expect(merged.stdout).not.toContain('export const legacy = [orders];');
  });

  it('outside the regions, a line of the template of an earlier version: the sentence says how to write it again', () => {
    const now = '// TypeORM writes no trigger:';
    const earlier = '// TODO(platform): TypeORM writes no trigger:';

    const root = twoSides({
      orm: 'typeorm',
      flags: ['--audit', 'on'],
      base: (project) => write(project, INDEX, read(project, INDEX).replace(now, earlier)),
      trunk: (project) => void store(project, 'billing', 'Order'),
      branch: (project) => void store(project, 'shipping', 'Order'),
    });

    const merged = mergeTrunk(root);

    const quoted =
      read(root, INDEX)
        .split('\n')
        .find((line) => line.startsWith(earlier)) ?? '';

    expect(merged.stdout).toContain(notWritten(read(root, INDEX), quoted));
    expect(merged.stdout).toContain('run `npx ddd-ts-kit init --force` after a commit');

    // Written again from the template of this version, the index is one the kit settles.
    const forced = forcedInit(root);

    expect(forced.stdout).toContain('imported two entities under the name `orders`');

    expect(
      lineTheKitDidNotWrite(new Workspace(root, false), readConfig(root).config, read(root, INDEX)),
    ).toBeUndefined();
  });
});
