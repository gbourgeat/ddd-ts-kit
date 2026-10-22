import { ARCHITECTURE_RULES } from './architecture-rules';
import { SUPPRESSION_RULE } from './suppression-rule';

/** The ids this checker runs, in the order `ddd-ts-kit rules` lists them. */
export const RULE_IDS: readonly string[] = [
  ...ARCHITECTURE_RULES.map((rule) => rule.id),
  'config/valid',
  SUPPRESSION_RULE.id,
];
