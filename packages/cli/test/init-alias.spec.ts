import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, walk, write } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

const RELATIVE = /(?:\bfrom|\bimport\(?)\s*['"]\.{1,2}\//;
const sources = (root: string): string[] => ['src', 'test', 'scripts'].flatMap((tree) => walk(root, tree));

describe('init and the import alias', () => {
  it('declares "@/" once under "paths" of tsconfig.json, leaves nothing in package.json, and points every tool at tsconfig', () => {
    const root = initProject();
    const scripts = Object(jsonAt(readJson(root, 'package.json'), 'scripts')) as Record<string, string>;

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'importAlias')).toBe('@/');

    expect(Object.keys(Object(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'paths')))).toEqual([
      '@/*',
      '$test/*',
      '$scripts/*',
    ]);

    expect(jsonAt(readJson(root, 'package.json'), 'imports')).toBeUndefined();
    expect(read(root, 'vitest.config.ts')).toContain('resolve: { tsconfigPaths: true },');
    expect(read(root, 'vitest.config.ts')).not.toContain('alias:');
    expect(read(root, 'vitest.e2e.config.ts')).toContain('resolve: { tsconfigPaths: true },');
    expect(read(root, '.dependency-cruiser.cjs')).toContain('"fileName": "tsconfig.json"');
    expect(read(root, 'knip.json')).not.toContain('"paths"');
    expect(scripts['start']).toBe('node dist/src/main.js');
    expect(scripts['dev']).toMatch(/^tsx watch --env-file-if-exists=\.env --import /);
    expect(scripts['db:generate']).toBe('ddd-ts-kit drizzle-generate --name');
    expect(scripts['build']).toMatch(/tsc -p tsconfig\.build\.json && ddd-ts-kit build-aliases$/);
  });

  it('leaves nothing of the mechanism it replaces: no condition, no flag, no subpath import, in any file init or a generator writes', () => {
    const root = tempDir('alias');

    scaffoldEverything(root);

    const leftovers = walk(root).filter((file) =>
      /--conditions|customExportConditions|ssr:\s*\{|['"`]#(?:src|test|scripts|generated)\//.test(read(root, file)),
    );

    expect(leftovers).toEqual([]);
    expect(read(root, '.dependency-cruiser.cjs')).not.toMatch(/"conditionNames": \[\s*"(?!import")/);
  });

  it('gives jest, which does not read tsconfig, the same mapping to the sources', () => {
    const config = read(initProject('--tests', 'jest'), 'jest.config.js');

    expect(config).toContain("'^@/(.*)$': '<rootDir>/src/$1.ts',");
    expect(config).toContain("'^\\\\$test/(.*)$': '<rootDir>/test/$1.ts',");
    expect(config).toContain("'^\\\\$scripts/(.*)$': '<rootDir>/scripts/$1.ts',");
    expect(config).not.toContain('dist');
    expect(config).not.toContain('customExportConditions');
  });

  it('gives jest the mapping with the extension in a project that writes it', () => {
    const config = read(initProject('--tests', 'jest', '--import-extension', 'js'), 'jest.config.js');

    expect(config).toContain("'^@/(.*)\\\\.js$': '<rootDir>/src/$1.ts',");
    expect(config).toContain("'^\\\\$test/(.*)\\\\.js$': '<rootDir>/test/$1.ts',");
    expect(config).toContain("'^\\\\$scripts/(.*)\\\\.js$': '<rootDir>/scripts/$1.ts',");
  });

  it('writes no relative import, whatever the kind generated, and every file imports by an alias', () => {
    const root = tempDir('alias');

    scaffoldEverything(root);

    const written = sources(root).filter((file) => file.endsWith('.ts'));

    expect(written.filter((file) => RELATIVE.test(read(root, file)))).toEqual([]);
    expect(written.filter((file) => read(root, file).includes("from '@/")).length).toBeGreaterThan(100);
    expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toContain("from '$test/e2e/support/");
    expect(read(root, 'scripts/openapi.ts')).toContain("from '@/platform/");

    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toContain("export * from '@/contexts/billing/");
  });

  it('takes another name with --import-alias and writes everything under it: config, tsconfig.json, every import', () => {
    const root = tempDir('alias');

    scaffoldEverything(root, DEFAULT_STACK, ['--import-alias', '$app/']);

    const written = sources(root).filter((file) => file.endsWith('.ts'));
    const report = checkJsonOf(cli(root, 'check', '--json'));

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'importAlias')).toBe('$app/');

    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'paths', '$app/*')).toEqual(['./src/*']);

    expect(written.filter((file) => /['"]@\//.test(read(root, file)))).toEqual([]);
    expect(written.filter((file) => RELATIVE.test(read(root, file)))).toEqual([]);
    expect(read(root, 'src/main.ts')).toContain("from '$app/platform/composition/compose-application';");
    expect(report.violations).toEqual([]);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it.each([
    ['#app/', 'a specifier that starts with "#" is a Node subpath import'],
    ['#/', 'a specifier that starts with "#" is a Node subpath import'],
    ['@app/', 'it is also how the packages of a scope are named, and dependency-cruiser resolves an installed package'],
    ['$test/', '"$test/" already names the directory test/'],
    ['$App/', 'the alias is "@/", or "$", one name in lower case'],
    ['~/', 'the alias is "@/", or "$", one name in lower case'],
    ['src/', 'the alias is "@/", or "$", one name in lower case'],
  ])('refuses --import-alias %s before writing anything, and says why', (alias, reason) => {
    const refused = initFailure('--import-alias', alias);

    expect(refused.code).toBe(2);
    expect(refused.message).toContain(`The import alias "${alias}" is not supported: ${reason}`);
    expect(refused.fix).toBe('Use "@/" or "$<name>/" (--import-alias, or "importAlias" in ddd-ts-kit.config.json).');
  });

  it('refuses to initialise over a config that still names a subpath import', () => {
    const root = tempDir('alias');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importAlias: '#app/', contexts: {} }));

    const result = cli(root, 'init', '--json');

    expect(result.code).toBe(2);
    expect(String(jsonAt(result.json(), 'error', 'message'))).toContain('The import alias "#app/" is not supported');
    expect(walk(root)).toEqual(['ddd-ts-kit.config.json']);
  });
});
