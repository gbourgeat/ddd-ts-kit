import { describe, expect, it } from 'vitest';
import { compilerOptionsOf } from '../src/check/alias/compiler-options-of';
import { tempDir, write } from './helpers';

/** A project whose tsconfig.build.json extends `parent`, beside the files `parent` may name. */
function extending(parent: unknown): string {
  const root = tempDir('extends');
  const json = (compilerOptions: unknown): string => JSON.stringify({ compilerOptions });

  write(root, 'tsconfig.json', json({ noEmit: true, outDir: 'dist' }));
  write(root, 'configs/strict.json', json({ strict: true, outDir: 'out' }));
  write(root, 'node_modules/@acme/tsconfig/tsconfig.json', json({ target: 'ES2023' }));
  write(root, 'node_modules/@acme/tsconfig/checks.json', json({ noUnusedLocals: true }));
  write(root, 'tsconfig.build.json', JSON.stringify({ extends: parent, compilerOptions: { noEmit: false } }));

  return root;
}

describe('the compiler options of a tsconfig that extends another', () => {
  it.each([
    ['a relative file', './tsconfig.json', { noEmit: false, outDir: 'dist' }],
    [
      'a relative file without its ".json", which the compiler completes',
      './tsconfig',
      { noEmit: false, outDir: 'dist' },
    ],
    [
      'a file of a directory, its paths answered from the root',
      './configs/strict',
      { strict: true, outDir: 'configs/out' },
    ],
    ['a package, by the tsconfig.json of its directory', '@acme/tsconfig', { target: 'ES2023' }],
    ['a file of a package', '@acme/tsconfig/checks.json', { noUnusedLocals: true }],
    ['a file of a package without its ".json"', '@acme/tsconfig/checks', { noUnusedLocals: true }],
    ['several, the last one winning', ['@acme/tsconfig', './tsconfig'], { target: 'ES2023', outDir: 'dist' }],
  ])('are inherited from %s', (_what, parent, inherited) => {
    expect(compilerOptionsOf({ root: extending(parent) }, 'tsconfig.build.json')).toMatchObject({
      ...inherited,
      noEmit: false,
    });
  });

  it('are its own alone when what it extends is nowhere in the project: a package of a node_modules above, a file that is absent', () => {
    expect(compilerOptionsOf({ root: extending(['@elsewhere/tsconfig', './absent']) }, 'tsconfig.build.json')).toEqual({
      noEmit: false,
    });
  });
});
