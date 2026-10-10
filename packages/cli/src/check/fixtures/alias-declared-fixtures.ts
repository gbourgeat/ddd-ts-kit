import { CONFIG_FILE } from '../../config/index.js';
import { aliasDeclarations } from './alias-declarations.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';

const RULE = 'imports/alias-declared';
const PATHS = { '@/*': ['./src/*'], '$test/*': ['./test/*'], '$scripts/*': ['./scripts/*'] };
const COMPILE = 'node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json';
const BUILD = `${COMPILE} && ddd-ts-kit build-aliases`;
const JEST_MAPPER = String.raw`moduleNameMapper: { '^\\$app/(.*)\\.js$': '<rootDir>/src/$1.ts', '^\\$test/(.*)\\.js$': '<rootDir>/test/$1.ts', '^\\$scripts/(.*)\\.js$': '<rootDir>/scripts/$1.ts' }`;

export const ALIAS_DECLARED_FIXTURES: readonly Fixture[] = [
  { ruleId: RULE, name: 'one declaration, and every tool pointed at it', expect: 'pass', files: aliasDeclarations() },
  {
    ruleId: RULE,
    name: 'another name for the source root, declared the same way; a jest config that repeats the mapping, and one that extends it',
    expect: 'pass',
    files: aliasDeclarations({
      [CONFIG_FILE]: config({ importAlias: '$app/' }),
      'tsconfig.json': tsconfig({ ...PATHS, '@/*': undefined, '$app/*': ['./src/*'] }),
      'jest.config.js': `export default { ${JEST_MAPPER}, ...governedJestCoverage() };\n`,
      'jest.e2e.config.js': "import base from './jest.config.js';\nexport default { ...base };\n",
    }),
  },
  failing('a Node subpath import as the alias', CONFIG_FILE, config({ importAlias: '#app/' })),
  failing('an alias that could be any package', CONFIG_FILE, config({ importAlias: 'app/' })),
  failing('an alias that is the name of a scope', CONFIG_FILE, config({ importAlias: '@app/' })),
  failing('an alias that already names the tests', CONFIG_FILE, config({ importAlias: '$test/' })),
  failing('no "paths" in tsconfig.json', 'tsconfig.json', tsconfig(undefined)),
  failing(
    'the alias of the config under another name in tsconfig.json',
    'tsconfig.json',
    tsconfig({ ...PATHS, '@/*': undefined, '$app/*': ['./src/*'] }),
  ),
  failing('an alias that names the compiled files', 'tsconfig.json', tsconfig({ ...PATHS, '@/*': ['./dist/src/*'] })),
  failing(
    'a second entry under the alias',
    'tsconfig.json',
    tsconfig({ ...PATHS, '@/platform/*': ['./src/platform/*'] }),
  ),
  failing('a "baseUrl" that moves every target', 'tsconfig.json', tsconfig(PATHS, { baseUrl: './src' })),
  failing(
    'a build config with paths of its own',
    'tsconfig.build.json',
    json({ extends: './tsconfig.json', compilerOptions: { paths: { '@/*': ['./lib/*'] } } }),
  ),
  failing('a build that compiles and does not rewrite the aliases', 'package.json', manifest({ build: COMPILE })),
  failing(
    'a rewrite that runs before the compiler',
    'package.json',
    manifest({ build: `ddd-ts-kit build-aliases && ${COMPILE}` }),
  ),
  failing(
    'a dev script that runs the sources under another tsconfig',
    'package.json',
    manifest({ build: BUILD, dev: 'tsx watch --tsconfig tsconfig.dev.json src/main.ts' }),
  ),
  failing(
    'a vitest config that does not read tsconfig',
    'vitest.config.ts',
    "export default { test: { coverage: governedCoverage('') } };\n",
  ),
  failing(
    'a jest config without the mapping',
    'jest.config.js',
    "export default { testEnvironment: 'node', ...governedJestCoverage() };\n",
  ),
  failing(
    'a jest config that maps the alias to the compiled files',
    'jest.config.js',
    String.raw`export default { moduleNameMapper: { '^@/(.*)\\.js$': '<rootDir>/dist/src/$1.js', '^\\$test/(.*)\\.js$': '<rootDir>/test/$1.ts', '^\\$scripts/(.*)\\.js$': '<rootDir>/scripts/$1.ts' }, ...governedJestCoverage() };` +
      '\n',
  ),
  failing(
    'a dependency-cruiser config that does not read tsconfig',
    '.dependency-cruiser.cjs',
    "module.exports = { options: { enhancedResolveOptions: { conditionNames: ['import'] } } };\n",
  ),
  failing('a knip config that maps the alias', 'knip.json', json({ paths: { '@/*': ['./src/*'] } })),
];

function tsconfig(paths: unknown, more: Record<string, unknown> = {}): string {
  return json({ compilerOptions: { rootDir: '.', outDir: 'dist', paths, ...more } });
}

function manifest(scripts: Record<string, string>): string {
  return json({ name: 'fixture', type: 'module', scripts });
}

function failing(name: string, file: string, content: string): Fixture {
  return { ruleId: RULE, name, expect: { file }, files: aliasDeclarations({ [file]: content }) };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
