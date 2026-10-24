import type { PageSection } from './page-section';
import type { SpecRules, StatedRule } from './rules-in';

/** What a page counts: the rules stated, planned and put aside, and the specs they come from. */
export interface PageCounts {
  readonly stated: number;
  readonly planned: number;
  readonly aside: number;
  readonly specs: number;
}

export function countsOf(sections: readonly PageSection[]): PageCounts {
  const counts = { stated: 0, planned: 0, aside: 0, specs: 0 };

  for (const { rules } of sections.flatMap((section) => section.specs)) {
    counts.specs += 1;

    for (const rule of allRules(rules)) {
      counts[rule.state] += 1;
    }
  }

  return counts;
}

function allRules(rules: SpecRules): StatedRule[] {
  return [...rules.rules, ...rules.groups.flatMap(allRules)];
}
