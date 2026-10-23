import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { FixtureFiles } from './fixture-files';
import { project } from './project';

/** Written out, not derived: the fixtures do not prove the rule with its own code. */
const MANIFEST = {
  name: 'fixture',
  type: 'module',
  scripts: {
    build: 'node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json && ddd-ts-kit build-aliases',
    typecheck: 'node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit',
    start: 'node dist/src/main.js',
    dev: 'tsx watch --env-file-if-exists=.env src/main.ts',
  },
  dependencies: { '@ddd-ts-kit/kernel': '^0.1.0' },
};

const TSCONFIG = {
  // A comment and a trailing comma are read, as the compiler reads them.
  compilerOptions: {
    module: 'NodeNext',
    rootDir: '.',
    paths: { '@/*': ['./src/*'], '$test/*': ['./test/*'], '$scripts/*': ['./scripts/*'] },
    outDir: 'dist',
  },
  include: ['src', 'scripts', 'test'],
};

/** What `init` writes to declare the alias and point every tool at it, with what a fixture changes over it. */
export function aliasDeclarations(overrides: FixtureFiles = {}): FixtureFiles {
  return project(
    {},
    {
      [CONFIG_FILE]: config({ importAlias: '@/' }),
      'package.json': json(MANIFEST),
      'tsconfig.json': `// The type check.\n${json(TSCONFIG).replace('"dist"\n', '"dist",\n')}`,
      'tsconfig.build.json': json({ extends: './tsconfig.json', exclude: ['test'] }),
      'vitest.config.ts':
        "export default { resolve: { tsconfigPaths: true }, test: { coverage: governedCoverage('') } };\n",
      'vitest.e2e.config.ts': "export { default } from './vitest.config.js';\n",
      '.dependency-cruiser.cjs': "module.exports = { options: { tsConfig: { fileName: 'tsconfig.json' } } };\n",
      'knip.json': json({ entry: ['src/main.ts'] }),
      ...overrides,
    },
  );
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
