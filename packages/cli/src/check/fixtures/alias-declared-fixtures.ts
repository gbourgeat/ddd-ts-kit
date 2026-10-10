import { CONFIG_FILE } from '../../config/index.js';
import { aliasDeclarations } from './alias-declarations.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';

const RULE = 'imports/alias-declared';
const CONDITION = 'ddd-ts-kit-source';
const SOURCES = { [CONDITION]: './src/*.ts', default: './dist/src/*.js' };
const TESTS = './test/*.ts';
const SCRIPTS = { [CONDITION]: './scripts/*.ts', default: './dist/scripts/*.js' };
const IMPORTS = { '#src/*.js': SOURCES, '#test/*.js': TESTS, '#scripts/*.js': SCRIPTS };
const DEV = `tsx watch --conditions=${CONDITION} src/main.ts`;

export const ALIAS_DECLARED_FIXTURES: readonly Fixture[] = [
  { ruleId: RULE, name: 'one declaration, and every tool pointed at it', expect: 'pass', files: aliasDeclarations() },
  {
    ruleId: RULE,
    name: 'another name for the source root, declared the same way; a jest config that extends the one that sets the condition',
    expect: 'pass',
    files: aliasDeclarations({
      [CONFIG_FILE]: config({ importAlias: '#app/' }),
      'package.json': manifest({ '#app/*.js': SOURCES, '#test/*.js': TESTS, '#scripts/*.js': SCRIPTS }),
      'jest.config.js': `export default { testEnvironmentOptions: { customExportConditions: ['${CONDITION}'] }, ...governedJestCoverage() };\n`,
      'jest.e2e.config.js': "import base from './jest.config.js';\nexport default { ...base };\n",
    }),
  },
  failing('a tsconfig path as the alias: Node does not read it', CONFIG_FILE, config({ importAlias: '@/' })),
  failing('"#/", which Node 22 refuses', CONFIG_FILE, config({ importAlias: '#/' })),
  failing('an alias that already names the tests', CONFIG_FILE, config({ importAlias: '#test/' })),
  failing('no "imports" in package.json', 'package.json', manifest(undefined)),
  failing(
    'the alias of the config under another name in package.json',
    'package.json',
    manifest({ '#app/*.js': SOURCES, '#test/*.js': TESTS, '#scripts/*.js': SCRIPTS }),
  ),
  failing(
    'a compiled target that is not where tsconfig writes',
    'package.json',
    manifest({ ...IMPORTS, '#src/*.js': { [CONDITION]: './src/*.ts', default: './build/src/*.js' } }),
  ),
  failing(
    'the compiled target first: the source condition would never be reached',
    'package.json',
    manifest({ ...IMPORTS, '#src/*.js': { default: './dist/src/*.js', [CONDITION]: './src/*.ts' } }),
  ),
  failing(
    'a second entry under the alias',
    'package.json',
    manifest({ ...IMPORTS, '#src/platform/*.js': './src/platform/*.ts' }),
  ),
  failing(
    'a dev script that runs the sources without the condition',
    'package.json',
    manifest(IMPORTS, 'tsx watch src/main.ts'),
  ),
  failing(
    'a tsconfig that maps the alias under "paths"',
    'tsconfig.json',
    json({ compilerOptions: { rootDir: '.', outDir: 'dist', paths: { '#src/*': ['./src/*'] } } }),
  ),
  failing(
    'a resolution that does not read "imports"',
    'tsconfig.json',
    json({ compilerOptions: { rootDir: '.', outDir: 'dist', moduleResolution: 'node10' } }),
  ),
  failing(
    'a build that writes elsewhere than the type check maps',
    'tsconfig.build.json',
    json({ extends: './tsconfig.json', compilerOptions: { outDir: 'build' } }),
  ),
  failing(
    'a vitest config without the condition',
    'vitest.config.ts',
    "export default { test: { coverage: governedCoverage('') } };\n",
  ),
  failing(
    'a jest config without the condition',
    'jest.config.js',
    "export default { testEnvironment: 'node', ...governedJestCoverage() };\n",
  ),
  failing(
    'a dependency-cruiser config without the condition',
    '.dependency-cruiser.cjs',
    "module.exports = { options: { enhancedResolveOptions: { conditionNames: ['import'] } } };\n",
  ),
  failing('a knip config that maps the alias', 'knip.json', json({ paths: { '#src/*': ['./src/*'] } })),
];

function manifest(imports: unknown, dev = DEV): string {
  return json({ name: 'fixture', type: 'module', imports, scripts: { dev } });
}

function failing(name: string, file: string, content: string): Fixture {
  return { ruleId: RULE, name, expect: { file }, files: aliasDeclarations({ [file]: content }) };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
