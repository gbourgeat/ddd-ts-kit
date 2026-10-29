import type { SpecRules, StatedRule } from './rules-in';

/** Every rule of a spec, its groups included, in the order of the file. */
export function allRules(rules: SpecRules): StatedRule[] {
  return [...rules.rules, ...rules.groups.flatMap(allRules)];
}
