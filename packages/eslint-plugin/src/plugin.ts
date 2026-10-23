import stylistic from '@stylistic/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { TYPESCRIPT_FILES } from './presets/create-ddd-ts-kit';
import { pluginRuleLevels } from './presets/plugin-rule-levels';
import { ESCAPE_HATCH_RULES } from './presets/standard-rules';
import { rules } from './rules/rules';
import { VERSION } from './version';

type ConfigArray = TSESLint.FlatConfig.ConfigArray;

interface DddTsKitPlugin extends TSESLint.FlatConfig.Plugin {
  readonly configs: { recommended: ConfigArray; strict: ConfigArray };
}

export const plugin: DddTsKitPlugin = {
  meta: { name: '@ddd-ts-kit/eslint-plugin', version: VERSION },
  rules,
  configs: { recommended: [], strict: [] },
};

plugin.configs.recommended = preset('recommended');
plugin.configs.strict = preset('error');

/**
 * The rules of this plugin, the typescript-eslint rules they delegate to and the layout rules
 * of `@stylistic/eslint-plugin`, on TypeScript files, without type information.
 */
function preset(level: 'recommended' | 'error'): ConfigArray {
  return [
    {
      name: `ddd-ts-kit/${level === 'error' ? 'strict' : 'recommended'}`,
      files: TYPESCRIPT_FILES,
      languageOptions: { parser: tseslint.parser },
      plugins: { 'ddd-ts-kit': plugin, '@typescript-eslint': tseslint.plugin, '@stylistic': stylistic },
      rules: { ...pluginRuleLevels(level), ...ESCAPE_HATCH_RULES },
    },
  ];
}
