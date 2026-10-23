import { DELEGATED_RULES } from './delegated-rules';
import { RULE_IDS } from './rule-ids';

/** Every id the config may name under `rules`: the ones checked here and the ones another tool holds. */
export const KNOWN_RULE_IDS: readonly string[] = [...RULE_IDS, ...DELEGATED_RULES.map((rule) => rule.id)];
