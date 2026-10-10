import { ESLINT_ONLY_RULES } from './eslint-only-rules.js';
import { RULE_IDS } from './rule-ids.js';

/** Every id the config may name under `rules`: the ones checked here and the ones ESLint holds. */
export const KNOWN_RULE_IDS: readonly string[] = [...RULE_IDS, ...ESLINT_ONLY_RULES.map((rule) => rule.id)];
