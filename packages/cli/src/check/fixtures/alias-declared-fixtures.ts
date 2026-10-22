import { CONFIG_FILE } from '../../config';
import { aliasDeclarations } from './alias-declarations';
import { config } from './config';
import type { Fixture } from './fixture';

const RULE = 'imports/alias-declared';
const PATHS = { '@/*': ['./src/*'], '$test/*': ['./test/*'], '$scripts/*': ['./scripts/*'] };
const COMPILE = 'node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json';
const BUILD = `${COMPILE} && ddd-ts-kit build-aliases`;
const JEST_MAPPER = String.raw`moduleNameMapper: { '^\\$app/(.*)\\.js$': '<rootDir>/src/$1.ts', '^\\$test/(.*)\\.js$': '<rootDir>/test/$1.ts', '^\\$scripts/(.*)\\.js$': '<rootDir>/scripts/$1.ts' }`;

const BARE_JEST_MAPPER = String.raw`moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1.ts', '^\\$test/(.*)$': '<rootDir>/test/$1.ts', '^\\$scripts/(.*)$': '<rootDir>/scripts/$1.ts' }`;
const BUNDLER = { module: 'ESNext', moduleResolution: 'Bundler', customConditions: ['node'] };

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
  {
    ruleId: RULE,
    name: 'imports written without an extension: the compiler resolves as a bundler, jest maps the specifier as written',
    expect: 'pass',
    files: aliasDeclarations({
      [CONFIG_FILE]: config({ importAlias: '@/', importExtension: 'none' }),
      'tsconfig.json': tsconfig(PATHS, BUNDLER),
      'jest.config.js': `export default { ${BARE_JEST_MAPPER}, ...governedJestCoverage() };\n`,
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
  failing(
    'imports written with ".js" and a compiler that resolves as a bundler',
    'tsconfig.json',
    tsconfig(PATHS, BUNDLER),
  ),
  failing(
    'imports written with ".js" and a module resolution that does not require it',
    'tsconfig.json',
    tsconfig(PATHS, { moduleResolution: 'Bundler' }),
  ),
  bare('a compiler that resolves as Node does', 'tsconfig.json', tsconfig(PATHS)),
  bare(
    'a module resolution that requires the extension',
    'tsconfig.json',
    tsconfig(PATHS, { ...BUNDLER, moduleResolution: 'NodeNext' }),
  ),
  bare(
    'a bundler resolution that no longer reads the entry a package has for Node',
    'tsconfig.json',
    tsconfig(PATHS, { ...BUNDLER, customConditions: [] }),
  ),
  bare(
    'a module format that is not the one the build completes',
    'tsconfig.json',
    tsconfig(PATHS, { ...BUNDLER, module: 'CommonJS' }),
  ),
  bare(
    'a build config that resolves another way than the type check',
    'tsconfig.build.json',
    json({ extends: './tsconfig.json', compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } }),
  ),
  bare(
    'a jest config that still maps the specifier with ".js"',
    'jest.config.js',
    `export default { ${JEST_MAPPER.replace(String.raw`\\$app`, '@')}, ...governedJestCoverage() };\n`,
  ),
  bare('a build that compiles and does not rewrite the aliases', 'package.json', manifest({ build: COMPILE })),
];

function tsconfig(paths: unknown, more: Record<string, unknown> = {}): string {
  return json({ compilerOptions: { module: 'NodeNext', rootDir: '.', outDir: 'dist', paths, ...more } });
}

/** A failing fixture of a project that writes its imports without an extension, everything else as `init` writes it. */
function bare(name: string, file: string, content: string): Fixture {
  const files = aliasDeclarations({
    [CONFIG_FILE]: config({ importAlias: '@/', importExtension: 'none' }),
    'tsconfig.json': tsconfig(PATHS, BUNDLER),
    'jest.config.js': `export default { ${BARE_JEST_MAPPER}, ...governedJestCoverage() };\n`,
    [file]: content,
  });

  return { ruleId: RULE, name: `without an extension: ${name}`, expect: { file }, files };
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
