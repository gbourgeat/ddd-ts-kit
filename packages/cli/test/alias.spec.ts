import { describe, expect, it } from 'vitest';
import {
  aliasProblem,
  aliasRoots,
  compilerPaths,
  directoryAlias,
  moduleNameMapper,
  toAlias,
} from '../src/alias/index.js';
import { parseConfig } from '../src/config/index.js';

const DEFAULT = parseConfig({});
const ROOTS = aliasRoots(DEFAULT);

describe('the import alias', () => {
  it('is "@/" unless the config says otherwise, next to the fixed aliases of the tests and the scripts', () => {
    expect(DEFAULT.importAlias).toBe('@/');

    expect(ROOTS).toEqual([
      { prefix: '@/', directory: 'src' },
      { prefix: '$test/', directory: 'test' },
      { prefix: '$scripts/', directory: 'scripts' },
    ]);

    expect(aliasRoots(parseConfig({ stack: { orm: 'prisma' } })).at(-1)).toEqual({
      prefix: '$generated/',
      directory: 'generated',
    });
  });

  it('derives the "paths" of tsconfig.json: each alias names its source directory, from the directory of the tsconfig', () => {
    expect(compilerPaths(ROOTS)).toEqual({
      '@/*': ['./src/*'],
      '$test/*': ['./test/*'],
      '$scripts/*': ['./scripts/*'],
    });
  });

  it('follows a renamed or nested source root, and gives jest the same mapping to the sources', () => {
    const nested = aliasRoots(parseConfig({ sourceRoot: 'apps/api/src', importAlias: '$api/' }));

    expect(compilerPaths(nested)['$api/*']).toEqual(['./apps/api/src/*']);

    expect(moduleNameMapper(nested)).toEqual({
      '^\\$api/(.*)\\.js$': '<rootDir>/apps/api/src/$1.ts',
      '^\\$test/(.*)\\.js$': '<rootDir>/test/$1.ts',
      '^\\$scripts/(.*)\\.js$': '<rootDir>/scripts/$1.ts',
    });

    expect(new RegExp(Object.keys(moduleNameMapper(ROOTS))[0] ?? '').exec('@/platform/errors.js')?.[1]).toBe(
      'platform/errors',
    );
  });

  it.each([
    ['src/platform/errors.ts', '@/platform/errors.js'],
    [
      'src/contexts/billing/domain/aggregates/invoice.aggregate.js',
      '@/contexts/billing/domain/aggregates/invoice.aggregate.js',
    ],
    ['src/main', '@/main.js'],
    ['test/e2e/support/start-application.ts', '$test/e2e/support/start-application.js'],
    ['scripts/openapi.ts', '$scripts/openapi.js'],
    ['package.json', undefined],
    ['srcs/x.ts', undefined],
    ['generated/prisma/client.ts', undefined],
  ])('names %s as %s', (file, alias) => {
    expect(toAlias(ROOTS, file)).toBe(alias);
  });

  it('names a directory of the project without a final slash, and refuses one no alias reaches', () => {
    expect(directoryAlias(ROOTS, 'src')).toBe('@');
    expect(directoryAlias(ROOTS, 'src/platform')).toBe('@/platform');

    expect(() => directoryAlias(ROOTS, 'lib/platform')).toThrow(
      'lib/platform is under no directory an import alias names.',
    );
  });

  it.each([
    ['@/', undefined],
    ['$app/', undefined],
    ['$my-api2/', undefined],
    ['#app/', /starts with "#" is a Node subpath import/],
    ['#/', /starts with "#" is a Node subpath import/],
    ['@app/', /it is also how the packages of a scope are named/],
    ['@test/', /it is also how the packages of a scope are named/],
    ['~/', /the alias is "@\/", or "\$", one name in lower case/],
    ['app/', /the two forms that can never be the name of a package/],
    ['$/', /one name in lower case/],
    ['$app', /one name in lower case/],
    ['$App/', /one name in lower case/],
    ['$a/b/', /one name in lower case/],
    ['$test/', /already names the directory test\//],
    ['$scripts/', /already names the directory scripts\//],
    ['$generated/', /already names the directory generated\//],
  ])('says of "%s" whether every tool can resolve it', (alias, problem) => {
    if (problem === undefined) {
      expect(aliasProblem(alias)).toBeUndefined();
    } else {
      expect(aliasProblem(alias)).toMatch(problem);
    }
  });
});
