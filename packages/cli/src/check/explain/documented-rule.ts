import { CliError } from '../../cli-error';
import { RULES } from '../catalogue/rules';
import { SUPPRESSION_RULE } from '../catalogue/suppression-rule';
import type { RuleDoc } from '../model/rule-doc';
import { RULE_DOCS } from './rule-docs';

export interface DocumentedRule extends RuleDoc {
  readonly id: string;
  readonly description: string;
}

/** The description and the documentation of a rule this checker judges; a rule without both is a bug of the kit. */
export function documentedRule(id: string): DocumentedRule {
  const rule = [...RULES, SUPPRESSION_RULE].find((candidate) => candidate.id === id);
  const doc = RULE_DOCS[id];

  if (rule === undefined || doc === undefined) {
    throw new CliError(`The rule "${id}" has no explanation.`, 'Report this as a bug of ddd-ts-kit.');
  }

  return { id, description: rule.description, ...doc };
}
