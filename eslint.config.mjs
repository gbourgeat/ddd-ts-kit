import js from '@eslint/js';
import dddTsKit, { standardRules } from '@ddd-ts-kit/eslint-plugin';
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

export default defineConfig(
  {
    name: 'workspace/ignores',
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'reports/**', 'packages/cli/templates/**', 'packages/prisma/test/generated/**', '**/*.d.ts'],
  },
  {
    name: 'workspace/sources',
    files: ['packages/*/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    plugins: { 'ddd-ts-kit': dddTsKit },
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { ...standardRules.cleanCode, ...standardRules.typedCleanCode, ...standardRules.escapeHatch, ...standardRules.kitConventions, ...CLEAN_RULES },
  },
  {
    name: 'workspace/tests',
    files: ['packages/*/test/**/*.ts', 'vitest.config.ts', 'pipeline/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'ddd-ts-kit': dddTsKit },
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
    rules: {
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
