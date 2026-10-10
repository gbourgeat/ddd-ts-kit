import fs from 'node:fs';
import js from '@eslint/js';
import dddTsKit, { standardRules } from '@ddd-ts-kit/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const CLEAN_RULES = {
  'ddd-ts-kit/clean-stepdown': 'error',
  'ddd-ts-kit/clean-function-size': 'warn',
  'ddd-ts-kit/clean-no-commented-out-code': 'error',
  'ddd-ts-kit/clean-no-noise-comment': 'warn',
  'ddd-ts-kit/clean-no-escape-hatch': 'error',
};

/** Files whose several exports are one thing that the general allowances of the rule cannot see. */
const ONE_PER_FILE_ALLOW = [];

/** Holds everywhere, tests included: private members, file and function ceilings, blank lines. */
const SHAPE_RULES = {
  ...standardRules.layout,
  'ddd-ts-kit/clean-no-hash-private': 'error',
  'ddd-ts-kit/clean-file-size': 'error',
  'ddd-ts-kit/clean-function-ceiling': 'error',
};

export default defineConfig(
  {
    name: 'workspace/ignores',
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'reports/**', 'packages/cli/templates/**', 'packages/prisma/test/generated/**', '**/*.d.ts'],
  },
  {
    name: 'workspace/sources',
    files: ['packages/*/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    plugins: { 'ddd-ts-kit': dddTsKit, '@stylistic': stylistic },
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      ...standardRules.cleanCode,
      ...standardRules.typedCleanCode,
      ...standardRules.escapeHatch,
      ...standardRules.kitConventions,
      ...CLEAN_RULES,
      ...SHAPE_RULES,
      'ddd-ts-kit/clean-one-export-per-file': ['error', { entries: subpathEntries(), allow: ONE_PER_FILE_ALLOW }],
    },
  },
  {
    name: 'workspace/tests',
    files: ['packages/*/test/**/*.ts', 'vitest.config.ts', 'pipeline/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'ddd-ts-kit': dddTsKit, '@stylistic': stylistic },
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
    rules: {
      ...SHAPE_RULES,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': standardRules.kitConventions['@typescript-eslint/no-unused-vars'],
      'ddd-ts-kit/clean-no-commented-out-code': 'error',
      'ddd-ts-kit/clean-no-escape-hatch': ['error', { typeAssertions: false }],
    },
  },
  {
    name: 'workspace/scripts',
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    extends: [js.configs.recommended],
    plugins: { 'ddd-ts-kit': dddTsKit },
    languageOptions: { globals: globals.node },
    rules: { 'ddd-ts-kit/clean-stepdown': 'error', 'ddd-ts-kit/clean-no-commented-out-code': 'error', 'ddd-ts-kit/clean-function-size': 'warn' },
  },
);

/** The subpath entry files of every package, read from its `exports`: `./dist/x.js` is built from `src/x.ts`. */
function subpathEntries() {
  return fs.readdirSync(new URL('packages', import.meta.url)).flatMap((name) => {
    const manifest = JSON.parse(fs.readFileSync(new URL(`packages/${name}/package.json`, import.meta.url), 'utf8'));

    return builtFiles(manifest.exports).map((file) => `packages/${name}/src/${file}.ts`);
  });
}

function builtFiles(exported) {
  if (typeof exported === 'string') return [...exported.matchAll(/^\.\/dist\/(.+)\.js$/g)].map((match) => match[1]);

  return [...new Set(Object.values(exported ?? {}).flatMap(builtFiles))];
}
