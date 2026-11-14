import { beforeAll, describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { lineTheKitDidNotWrite } from '../src/generate/kinds/same-name/line-the-kit-did-not-write';
import { Workspace } from '../src/workspace';
import { read } from './helpers';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { initProject } from './support/init-project';

describe('the first line of a TypeORM schema index the kit did not write', () => {
  let root = '';
  let index = '';

  const firstForeign = (text: string): ReturnType<typeof lineTheKitDidNotWrite> =>
    lineTheKitDidNotWrite(new Workspace(root, false), readConfig(root).config, text);

  beforeAll(() => {
    root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'pnpm');
    store(root, 'billing', 'Order');
    store(root, 'shipping', 'Order');
    index = read(root, INDEX);
  });

  it('is none in the index the kit wrote, in the dialect of its package manager, nor with a blank line closing a region', () => {
    expect(firstForeign(index)).toBeUndefined();
    expect(firstForeign(index.replace('\n// /ddd-ts-kit:imports', '\n\n// /ddd-ts-kit:imports'))).toBeUndefined();
  });

  it('is the last line held when the index ends before the lines the template writes', () => {
    const cut = index.slice(0, index.lastIndexOf('];'));
    const lines = cut.trimEnd().split('\n');

    expect(firstForeign(cut)).toEqual({ line: lines.length, text: lines.at(-1), inRegion: false });
  });

  it('is an import of the region from a package that is not of the kit', () => {
    const held = index.replace(
      '// /ddd-ts-kit:imports',
      "import { inspect } from 'node:util';\n// /ddd-ts-kit:imports",
    );

    expect(firstForeign(held)?.text).toBe("import { inspect } from 'node:util';");
  });
});
