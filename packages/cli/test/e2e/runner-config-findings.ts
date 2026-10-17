import fs from 'node:fs';
import path from 'node:path';
import plugin from '@ddd-ts-kit/eslint-plugin';
import { type ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/** The configuration files of the test runner a project gets, whichever runner its stack names. */
const RUNNER_CONFIGS = ['vitest.config.ts', 'vitest.e2e.config.ts', 'jest.config.js', 'jest.e2e.config.js'];

/**
 * What the size rules of the preset say about the test runner configuration of a new project:
 * ESLint lints those files on the first commit, where `ddd-ts-kit check`, which judges the
 * sources, does not look. Read without an install, through the plugin of this repository.
 */
export function runnerConfigFindings(root: string): string[] {
  const linter = new Linter({ cwd: root });

  const config: Linter.Config = {
    files: ['**/*.ts', '**/*.js'],
    // Typed for typescript-eslint, which the configuration of a project hands to ESLint as it is.
    plugins: { 'ddd-ts-kit': plugin as ESLint.Plugin },
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    rules: { 'ddd-ts-kit/clean-function-size': 'warn', 'ddd-ts-kit/clean-function-ceiling': 'warn' },
  };

  return RUNNER_CONFIGS.filter((file) => fs.existsSync(path.join(root, file))).flatMap((file) =>
    linter
      .verify(fs.readFileSync(path.join(root, file), 'utf8'), config, path.join(root, file))
      .map((message) => `${file}:${message.line} ${message.ruleId ?? 'parse'} ${message.message}`),
  );
}
