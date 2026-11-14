import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { git } from './support/git';
import { byNameLines, expectNoTableLost, INDEX, store } from './support/index-invariant';
import { READABLE_SHAPES, unreadShapes } from './support/tables-file-shapes';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';

const ALL = ['billing.orders', 'shipping.orders', 'returns.orders'];

/** The lines by name of both sides: what the merge leaves when it settles nothing. */
function linesOfBothSides(root: string): string[] {
  const onTrunk = git(root, 'show', `main:${INDEX}`);

  return [...new Set([...byNameLines(read(root, INDEX)), ...byNameLines(onTrunk)])];
}

async function expectMergedWithEveryTable(root: string, readable: boolean): Promise<void> {
  const unsettled = linesOfBothSides(root);
  const merged = mergeTrunk(root);

  expect(merged.code, merged.stderr).toBe(0);
  expect(merged.stdout).toContain('committed');
  expect(fs.existsSync(path.join(root, '.git/MERGE_HEAD'))).toBe(false);

  await expectNoTableLost(root, { unsettled, tables: ALL, said: merged.stdout, readable });
}

/**
 * Whether a shape of the tables file of billing is one the settle tells apart from the table of the
 * same name of another context: on TypeORM only a file that declares the name itself, built by
 * `new`, is; a name it re-exports or renames is not settled, and the merge says so.
 */
function isToldApart(orm: string, shape: string): boolean {
  return (
    orm !== 'typeorm' ||
    ['as generated', 'two spaces after export', 'export indented', 'the name on the next line'].includes(shape)
  );
}

describe.each(['drizzle', 'typeorm'])('merge-trunk keeps every table of the schema index, on %s', (orm) => {
  const shapes = [
    ...Object.entries(READABLE_SHAPES).map(([name, shape]) => [name, shape, isToldApart(orm, name)] as const),
    ...Object.entries(unreadShapes(orm)).map(([name, shape]) => [name, shape, false] as const),
  ];

  it.each(shapes)('when the trunk holds the tables file of billing %s', async (_name, shape, readable) => {
    const root = twoSides({
      orm,
      trunk: (project) => {
        store(project, 'billing', 'Order');
        shape(project);
      },
      branch: (project) => {
        store(project, 'shipping', 'Order');
        store(project, 'returns', 'Order');
      },
    });

    await expectMergedWithEveryTable(root, readable);
  });

  it.each(shapes)('when the branch holds the tables file of billing %s', async (_name, shape, readable) => {
    const root = twoSides({
      orm,
      trunk: (project) => {
        store(project, 'shipping', 'Order');
        store(project, 'returns', 'Order');
      },
      branch: (project) => {
        store(project, 'billing', 'Order');
        shape(project);
      },
    });

    await expectMergedWithEveryTable(root, readable);
  });
});
