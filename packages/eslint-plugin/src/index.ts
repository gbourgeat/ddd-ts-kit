import type { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { createDddTsKit, pluginRuleLevels, TYPESCRIPT_FILES, type DddTsKitOptions } from './presets/helper.js';
import { CLEAN_CODE_RULES, ESCAPE_HATCH_RULES, KIT_CONVENTIONS, TYPED_CLEAN_CODE_RULES } from './presets/standard-rules.js';
import { rules } from './rules/index.js';

type ConfigArray = TSESLint.FlatConfig.ConfigArray;

export const VERSION = '0.1.0';

interface DddTsKitPlugin extends TSESLint.FlatConfig.Plugin {
  readonly configs: { recommended: ConfigArray; strict: ConfigArray };
}

const plugin: DddTsKitPlugin = {
  meta: { name: '@ddd-ts-kit/eslint-plugin', version: VERSION },
  rules,
  configs: { recommended: [], strict: [] },
};

plugin.configs.recommended = preset('recommended');
plugin.configs.strict = preset('error');

/** The standard rules the helper adds, for a config composed by hand. */
export const standardRules = {
  escapeHatch: ESCAPE_HATCH_RULES,
  cleanCode: CLEAN_CODE_RULES,
  typedCleanCode: TYPED_CLEAN_CODE_RULES,
  kitConventions: KIT_CONVENTIONS,
} as const;

/** The complete flat config of a ddd-ts-kit project. */
export function dddTsKit(options: DddTsKitOptions = {}): ConfigArray {
  return createDddTsKit(plugin, options);
}

/** The rules of this plugin and the typescript-eslint rules they delegate to, on TypeScript files, without type information. */
function preset(level: 'recommended' | 'error'): ConfigArray {
  return [
    {
      name: `ddd-ts-kit/${level === 'error' ? 'strict' : 'recommended'}`,
      files: TYPESCRIPT_FILES,
      languageOptions: { parser: tseslint.parser },
      plugins: { 'ddd-ts-kit': plugin, '@typescript-eslint': tseslint.plugin },
      rules: { ...pluginRuleLevels(level), ...ESCAPE_HATCH_RULES },
    },
  ];
}

export default plugin;
export { rules };
export type { DddTsKitOptions } from './presets/helper.js';
export type { PluginSettings } from './project/linted-file.js';
export type { RuleDocs } from './support/define-rule.js';
