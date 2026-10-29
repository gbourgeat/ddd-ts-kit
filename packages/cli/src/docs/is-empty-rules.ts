import type { SpecRules } from './rules-in';

/** A spec, or a group of it, that states no rule. */
export function isEmptyRules(rules: SpecRules): boolean {
  return rules.rules.length === 0 && rules.groups.every(isEmptyRules);
}
