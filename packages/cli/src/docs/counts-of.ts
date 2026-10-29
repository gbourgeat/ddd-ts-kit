import type { PageSection } from './page-section';
import { allRules } from './all-rules';

/** What a page counts: the rules stated, planned and put aside, and the specs they come from. */
export interface PageCounts {
  readonly stated: number;
  readonly planned: number;
  readonly aside: number;
  readonly specs: number;
}

/** A spec whose rules a page shares out between several headings counts once. */
export function countsOf(sections: readonly PageSection[]): PageCounts {
  const counts = { stated: 0, planned: 0, aside: 0 };
  const specs = sections.flatMap((section) => section.entries.flatMap((entry) => entry.specs));

  for (const rule of specs.flatMap((spec) => allRules(spec.rules))) {
    counts[rule.state] += 1;
  }

  return { ...counts, specs: new Set(specs.map((spec) => spec.file)).size };
}
