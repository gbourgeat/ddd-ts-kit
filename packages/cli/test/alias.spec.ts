import { describe, expect, it } from 'vitest';
import {
  aliasProblem,
  aliasRoots,
  compilerPaths,
  compilerResolutionOf,
  directoryAlias,
  moduleNameMapper,
  specifierOf,
  specifierSuffix,
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

    expect(moduleNameMapper(nested, '.js')).toEqual({
      '^\\$api/(.*)\\.js$': '<rootDir>/apps/api/src/$1.ts',
      '^\\$test/(.*)\\.js$': '<rootDir>/test/$1.ts',
      '^\\$scripts/(.*)\\.js$': '<rootDir>/scripts/$1.ts',
    });

    expect(new RegExp(Object.keys(moduleNameMapper(ROOTS, '.js'))[0] ?? '').exec('@/platform/errors.js')?.[1]).toBe(
      'platform/errors',
    );
  });

  it('gives jest a mapping without the extension when the imports are written without one, and still answers the TypeScript source alone', () => {
    const mapper = moduleNameMapper(ROOTS, '');
    const [pattern = '', target] = Object.entries(mapper)[0] ?? [];

    expect(mapper).toEqual({
      '^@/(.*)$': '<rootDir>/src/$1.ts',
      '^\\$test/(.*)$': '<rootDir>/test/$1.ts',
      '^\\$scripts/(.*)$': '<rootDir>/scripts/$1.ts',
    });

    expect(new RegExp(pattern).exec('@/contexts/billing/domain/aggregates/invoice.aggregate')?.[1]).toBe(
      'contexts/billing/domain/aggregates/invoice.aggregate',
    );

    expect(target).toBe('<rootDir>/src/$1.ts');
    expect(new RegExp(pattern).test('@ddd-ts-kit/kernel')).toBe(false);
    expect(new RegExp(pattern).test('@scope/package/file.js')).toBe(false);
  });
});

describe('the ending of an import and the names the alias gives', () => {
  it('reads "importExtension": a config without the key writes ".js", "none" writes nothing, and a wrong value is read as "js"', () => {
    expect(DEFAULT.importExtension).toBe('js');
    expect(specifierSuffix(DEFAULT.importExtension)).toBe('.js');
    expect(specifierSuffix('none')).toBe('');
    expect(specifierSuffix('ts')).toBe('.js');

    expect(compilerResolutionOf('none')).toEqual({
      module: 'ESNext',
      moduleResolution: 'Bundler',
      customConditions: ['node'],
    });

    expect(compilerResolutionOf('js')).toEqual({ module: 'NodeNext', moduleResolution: 'NodeNext' });
    expect(compilerResolutionOf('ts')).toEqual(compilerResolutionOf('js'));
  });

  it('names a file for a generator as the config writes its imports, and refuses one no alias reaches', () => {
    const bare = parseConfig({ importExtension: 'none' });

    expect(specifierOf(bare, 'src/platform/database/database.ts')).toBe('@/platform/database/database');
    expect(specifierOf(DEFAULT, 'src/platform/database/database.ts')).toBe('@/platform/database/database.js');
    expect(specifierOf(bare, 'test/e2e/support/start-application.ts')).toBe('$test/e2e/support/start-application');
    expect(() => specifierOf(bare, 'lib/x.ts')).toThrow('lib/x.ts is under no directory an import alias names.');
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
    expect(toAlias(ROOTS, file, '.js')).toBe(alias);
    expect(toAlias(ROOTS, file, '')).toBe(alias?.replace(/\.js$/, ''));
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
