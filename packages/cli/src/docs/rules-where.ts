import { isEmptyRules } from './is-empty-rules';
import type { RuleGroup, SpecRules, StatedRule } from './rules-in';

/** The rules of a spec that `keep` keeps, under the groups that hold them: a group left with none is dropped. */
export function rulesWhere(rules: SpecRules, keep: (rule: StatedRule) => boolean): SpecRules {
  return {
    rules: rules.rules.filter(keep),
    groups: rules.groups.flatMap((group): RuleGroup[] => {
      const kept = rulesWhere(group, keep);

      return isEmptyRules(kept) ? [] : [{ ...group, ...kept }];
    }),
  };
}
