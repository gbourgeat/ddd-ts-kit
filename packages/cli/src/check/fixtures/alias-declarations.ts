import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { FixtureFiles } from './fixture-files.js';
import { project } from './project.js';

const CONDITION = 'ddd-ts-kit-source';

/** Written out, not derived: the fixtures do not prove the rule with its own code. */
const MANIFEST = {
  name: 'fixture',
  type: 'module',
  imports: {
    '#src/*.js': { [CONDITION]: './src/*.ts', default: './dist/src/*.js' },
    '#test/*.js': './test/*.ts',
    '#scripts/*.js': { [CONDITION]: './scripts/*.ts', default: './dist/scripts/*.js' },
  },
  scripts: {
    start: 'node dist/src/main.js',
    dev: `tsx watch --conditions=${CONDITION} --env-file-if-exists=.env src/main.ts`,
  },
};

const TSCONFIG = {
  // A comment and a trailing comma are read, as the compiler reads them.
  compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: 'dist' },
  include: ['src', 'scripts', 'test'],
};

/** What `init` writes to declare the alias once and point every tool at it, with what a fixture changes over it. */
export function aliasDeclarations(overrides: FixtureFiles = {}): FixtureFiles {
  return project(
    {},
    {
      [CONFIG_FILE]: config({ importAlias: '#src/' }),
      'package.json': json(MANIFEST),
      'tsconfig.json': `// The type check.\n${json(TSCONFIG).replace('"dist"\n', '"dist",\n')}`,
      'tsconfig.build.json': json({ extends: './tsconfig.json', exclude: ['test'] }),
      'vitest.config.ts': `export default { ssr: { resolve: { conditions: ['${CONDITION}'] } }, test: { coverage: governedCoverage('') } };\n`,
      'vitest.e2e.config.ts': "export { default } from './vitest.config.js';\n",
      '.dependency-cruiser.cjs': `module.exports = { options: { enhancedResolveOptions: { conditionNames: ['${CONDITION}', 'import'] } } };\n`,
      'knip.json': json({ entry: ['src/main.ts'] }),
      ...overrides,
    },
  );
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
