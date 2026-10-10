import { bracesRules } from './braces-rules.js';
import { layoutRules } from './layout-rules.js';
import { CLEAN_CODE_RULES, ESCAPE_HATCH_RULES, KIT_CONVENTIONS, TYPED_CLEAN_CODE_RULES } from './standard-rules.js';

/** The standard rules the helper adds, for a config composed by hand. */
export const standardRules = {
  escapeHatch: ESCAPE_HATCH_RULES,
  cleanCode: CLEAN_CODE_RULES,
  typedCleanCode: TYPED_CLEAN_CODE_RULES,
  kitConventions: KIT_CONVENTIONS,
  /** `clean/blank-lines`: the two rules of `@stylistic/eslint-plugin`, registered under `@stylistic`. */
  layout: layoutRules('error'),
  /** `clean/braces`: `curly` of ESLint. */
  braces: bracesRules('error'),
} as const;
