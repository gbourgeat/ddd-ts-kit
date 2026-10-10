import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support.js';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, walk, write } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';

const RELATIVE = /(?:\bfrom|\bimport\(?)\s*['"]\.{1,2}\//;
const sources = (root: string): string[] => ['src', 'test', 'scripts'].flatMap((tree) => walk(root, tree));

describe('init and the import alias', () => {
  it('declares "#src/" once in package.json, names it nowhere in tsconfig, and tells every runner the source condition', () => {
    const root = initProject();

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'importAlias')).toBe('#src/');

    expect(Object.keys(Object(jsonAt(readJson(root, 'package.json'), 'imports')))).toEqual([
      '#src/*.js',
      '#test/*.js',
      '#scripts/*.js',
    ]);

    expect(jsonAt(readJson(root, 'tsconfig.json'), 'compilerOptions', 'paths')).toBeUndefined();
    expect(read(root, 'vitest.config.ts')).toContain("ssr: { resolve: { conditions: ['ddd-ts-kit-source'] } },");
    expect(read(root, 'vitest.config.ts')).not.toContain('alias:');
    expect(read(root, 'vitest.e2e.config.ts')).toContain("ssr: { resolve: { conditions: ['ddd-ts-kit-source'] } },");
    expect(jsonAt(readJson(root, 'package.json'), 'scripts', 'start')).toBe('node dist/src/main.js');

    expect(jsonAt(readJson(root, 'package.json'), 'scripts', 'dev')).toContain(
      'tsx watch --conditions=ddd-ts-kit-source ',
    );

    expect(jsonAt(readJson(root, 'package.json'), 'scripts', 'db:generate')).toBe(
      'node --conditions=ddd-ts-kit-source node_modules/drizzle-kit/bin.cjs generate',
    );
  });

  it('gives jest the condition instead of a path mapping', () => {
    const config = read(initProject('--tests', 'jest'), 'jest.config.js');

    expect(config).toContain(
      "testEnvironmentOptions: { customExportConditions: ['ddd-ts-kit-source', 'node', 'node-addons'] },",
    );

    expect(config).not.toContain('<rootDir>/src/$1');
  });

  it('writes no relative import, whatever the kind generated, and every file imports by an alias', () => {
    const root = tempDir('alias');

    scaffoldEverything(root);

    const written = sources(root).filter((file) => file.endsWith('.ts'));

    expect(written.filter((file) => RELATIVE.test(read(root, file)))).toEqual([]);
    expect(written.filter((file) => read(root, file).includes("from '#src/")).length).toBeGreaterThan(100);
    expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toContain("from '#test/e2e/support/");
    expect(read(root, 'scripts/openapi.ts')).toContain("from '#src/platform/");

    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toContain(
      "export * from '#src/contexts/billing/",
    );
  });

  it('takes another name with --import-alias and writes everything under it: config, package.json, every import', () => {
    const root = tempDir('alias');

    scaffoldEverything(root, DEFAULT_STACK, ['--import-alias', '#app/']);

    const written = sources(root).filter((file) => file.endsWith('.ts'));
    const report = checkJsonOf(cli(root, 'check', '--json'));

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'importAlias')).toBe('#app/');

    expect(jsonAt(readJson(root, 'package.json'), 'imports', '#app/*.js')).toEqual({
      'ddd-ts-kit-source': './src/*.ts',
      default: './dist/src/*.js',
    });

    expect(written.filter((file) => /['"]#src\//.test(read(root, file)))).toEqual([]);
    expect(written.filter((file) => RELATIVE.test(read(root, file)))).toEqual([]);
    expect(read(root, 'src/main.ts')).toContain("from '#app/platform/compose-application.js';");
    expect(report.violations).toEqual([]);
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it.each([
    ['@/', 'only a specifier that starts with "#" is a subpath import'],
    ['#/', 'Node 22 refuses a subpath import that starts with "#/"'],
    ['#test/', '"#test/" already names the directory test/'],
    ['#Src/', 'the alias is "#", one name in lower case'],
  ])('refuses --import-alias %s before writing anything, and says why', (alias, reason) => {
    const refused = initFailure('--import-alias', alias);

    expect(refused.code).toBe(2);
    expect(refused.message).toContain(`The import alias "${alias}" is not supported: ${reason}`);

    expect(refused.fix).toBe(
      'Use a subpath import such as "#src/" (--import-alias, or "importAlias" in ddd-ts-kit.config.json).',
    );
  });

  it('refuses to initialise over a config that still names a tsconfig path', () => {
    const root = tempDir('alias');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ importAlias: '@/', contexts: {} }));

    const result = cli(root, 'init', '--json');

    expect(result.code).toBe(2);
    expect(String(jsonAt(result.json(), 'error', 'message'))).toContain('The import alias "@/" is not supported');
    expect(walk(root)).toEqual(['ddd-ts-kit.config.json']);
  });
});
