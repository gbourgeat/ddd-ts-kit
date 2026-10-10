import { describe, expect, it } from 'vitest';
import { aliasProblem, aliasRoots, directoryAlias, importMap, toAlias } from '../src/alias/index.js';
import { parseConfig } from '../src/config/index.js';

const DEFAULT = parseConfig({});
const ROOTS = aliasRoots(DEFAULT);

describe('the import alias', () => {
  it('is "#src/" unless the config says otherwise, next to the fixed aliases of the tests and the scripts', () => {
    expect(DEFAULT.importAlias).toBe('#src/');

    expect(ROOTS).toEqual([
      { prefix: '#src/', directory: 'src', compiled: true },
      { prefix: '#test/', directory: 'test', compiled: false },
      { prefix: '#scripts/', directory: 'scripts', compiled: true },
    ]);

    expect(aliasRoots(parseConfig({ stack: { orm: 'prisma' } })).at(-1)).toEqual({
      prefix: '#generated/',
      directory: 'generated',
      compiled: true,
    });
  });

  it('derives the "imports" of package.json: sources under the source condition, compiled files otherwise, tests never compiled', () => {
    expect(importMap(ROOTS)).toEqual({
      '#src/*.js': { 'ddd-ts-kit-source': './src/*.ts', default: './dist/src/*.js' },
      '#test/*.js': './test/*.ts',
      '#scripts/*.js': { 'ddd-ts-kit-source': './scripts/*.ts', default: './dist/scripts/*.js' },
    });

    expect(Object.keys(importMap(ROOTS)['#src/*.js'] ?? {})).toEqual(['ddd-ts-kit-source', 'default']);
  });

  it('follows the build layout of tsconfig and a renamed or nested source root', () => {
    const nested = aliasRoots(parseConfig({ sourceRoot: 'apps/api/src', importAlias: '#api/' }));

    expect(importMap(nested, { rootDir: '.', outDir: 'build' })['#api/*.js']).toEqual({
      'ddd-ts-kit-source': './apps/api/src/*.ts',
      default: './build/apps/api/src/*.js',
    });

    expect(importMap(ROOTS, { rootDir: 'src', outDir: 'dist' })['#src/*.js']).toEqual({
      'ddd-ts-kit-source': './src/*.ts',
      default: './dist/*.js',
    });
  });

  it.each([
    ['src/platform/errors.ts', '#src/platform/errors.js'],
    [
      'src/contexts/billing/domain/aggregates/invoice.aggregate.js',
      '#src/contexts/billing/domain/aggregates/invoice.aggregate.js',
    ],
    ['src/main', '#src/main.js'],
    ['test/e2e/support/start-application.ts', '#test/e2e/support/start-application.js'],
    ['scripts/openapi.ts', '#scripts/openapi.js'],
    ['package.json', undefined],
    ['srcs/x.ts', undefined],
    ['generated/prisma/client.ts', undefined],
  ])('names %s as %s', (file, alias) => {
    expect(toAlias(ROOTS, file)).toBe(alias);
  });

  it('names a directory of the project without a final slash, and refuses one no alias reaches', () => {
    expect(directoryAlias(ROOTS, 'src')).toBe('#src');
    expect(directoryAlias(ROOTS, 'src/platform')).toBe('#src/platform');

    expect(() => directoryAlias(ROOTS, 'lib/platform')).toThrow(
      'lib/platform is under no directory an import alias names.',
    );
  });

  it.each([
    ['#src/', undefined],
    ['#app/', undefined],
    ['#my-api2/', undefined],
    ['@/', /only a specifier that starts with "#" is a subpath import/],
    ['~/', /only a specifier that starts with "#"/],
    ['#/', /Node 22 refuses a subpath import that starts with "#\/"/],
    ['#src', /one name in lower case/],
    ['#Src/', /one name in lower case/],
    ['#a/b/', /one name in lower case/],
    ['#test/', /already names the directory test\//],
    ['#scripts/', /already names the directory scripts\//],
    ['#generated/', /already names the directory generated\//],
  ])('says of "%s" whether every tool can resolve it', (alias, problem) => {
    if (problem === undefined) {
      expect(aliasProblem(alias)).toBeUndefined();
    } else {
      expect(aliasProblem(alias)).toMatch(problem);
    }
  });
});
