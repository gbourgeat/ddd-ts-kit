import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadProject } from '../src/check/project/load-project';
import { git } from './support/git';
import { projectWith, reported } from './rules-support';

const RULE = 'tree/closed';
const BILLING = 'src/contexts/billing';

/** A context holding a real stray directory, an ignored folder and the leftover of a sandbox. */
function strayAndLeftovers(): string {
  return projectWith({
    '.gitignore': 'node_modules\nsrc/contexts/billing/domain/scratch/\n',
    [`${BILLING}/domain/utils/rounding.ts`]: 'export const rounding = 1;\n',
    [`${BILLING}/domain/scratch/notes.ts`]: 'export const notes = 1;\n',
    [`${BILLING}/.claude/.cc-writes/marker`]: '',
  });
}

describe('the tree a check reads', () => {
  it('leaves out what git ignores and the dot-directories of a context, and still reports a stray directory', () => {
    const root = strayAndLeftovers();

    git(root, 'init', '-q');

    expect(reported(root, RULE).map(({ file }) => file)).toEqual([`${BILLING}/domain/utils`]);
  });

  it('does not read the sources of an ignored folder', () => {
    const root = strayAndLeftovers();

    git(root, 'init', '-q');

    const files = loadProject(root).files.map(({ path: file }) => file);

    expect(files).toContain(`${BILLING}/domain/utils/rounding.ts`);
    expect(files).not.toContain(`${BILLING}/domain/scratch/notes.ts`);
  });

  it('reads a tracked file even when a pattern of the ignore file names it', () => {
    const root = strayAndLeftovers();

    git(root, 'init', '-q');
    git(root, 'add', '-f', `${BILLING}/domain/scratch/notes.ts`);

    expect(reported(root, RULE).map(({ file }) => file)).toEqual([
      `${BILLING}/domain/scratch`,
      `${BILLING}/domain/utils`,
    ]);
  });

  it('walks every entry outside a git repository, the dot-directories of a context left out', () => {
    const root = strayAndLeftovers();

    expect(reported(root, RULE).map(({ file }) => file)).toEqual([
      `${BILLING}/domain/scratch`,
      `${BILLING}/domain/utils`,
    ]);
  });

  it('walks every entry of a project that sits in a folder its enclosing repository ignores', () => {
    const outer = projectWith({ '.gitignore': 'nested/\n' });

    git(outer, 'init', '-q');
    const root = path.join(outer, 'nested');

    fs.cpSync(strayAndLeftovers(), root, { recursive: true });

    expect(reported(root, RULE).map(({ file }) => file)).toEqual([
      `${BILLING}/domain/scratch`,
      `${BILLING}/domain/utils`,
    ]);
  });
});
