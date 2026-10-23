import { SUPPRESSION_RULE_ID } from '../suppressions/suppression-rule-id';

/**
 * The suppression check is run by the engine (it needs every directive), but is listed like a rule.
 * It holds the form of a directive; governance/recorded-deviation holds the decision record behind its reason.
 */
export const SUPPRESSION_RULE = {
  id: SUPPRESSION_RULE_ID,
  description: 'An inline suppression names its rule and gives a reason after `--`.',
} as const;
