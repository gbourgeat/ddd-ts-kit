import type { TSESLint } from '@typescript-eslint/utils';
import type { RuleDocs } from './rule-docs.js';

export type DddRule = TSESLint.RuleModule<string, readonly unknown[], RuleDocs>;

/** Every rule of this plugin is made by `defineRule`, which always writes its documentation. */
export function docsOf(rule: DddRule): RuleDocs {
  const { docs } = rule.meta;

  if (docs === undefined) {
    throw new TypeError('A rule of @ddd-ts-kit/eslint-plugin has no meta.docs.');
  }

  return docs;
}
