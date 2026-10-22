import { DELEGATED_RULES } from '../catalogue/delegated-rules';
import type { RuleExplanation } from '../model/rule-explanation';
import type { Violation } from '../model/violation';
import { documentedRule } from './documented-rule';

/** One explanation per rule the violations report, however many times, in the order of its first violation. */
export function explanationsOf(violations: readonly Violation[]): RuleExplanation[] {
  const ids = new Set(violations.map((violation) => violation.ruleId));

  return [...ids].map(explanationOf);
}

function explanationOf(id: string): RuleExplanation {
  const delegated = DELEGATED_RULES.find((rule) => rule.id === id);

  if (delegated !== undefined) {
    return { id, description: delegated.description, why: delegated.where, checkedBy: delegated.checkedBy };
  }

  const { description, why } = documentedRule(id);

  return { id, description, why };
}
