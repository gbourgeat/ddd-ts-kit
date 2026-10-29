import { allRules } from './all-rules';
import { isGeneratedTitle } from './is-generated-title';
import type { SpecOfPage } from './page-section';
import type { SpecRules } from './rules-in';
import { specSubject } from './spec-subject';

/** A spec as a page reads it: its subject, and the rules whose title a template of the kit wrote, each read once. */
export function specOfPage(file: string, rules: SpecRules): SpecOfPage {
  const subject = specSubject(file);

  return {
    file,
    rules,
    subject,
    generated: new Set(allRules(rules).filter((rule) => isGeneratedTitle(subject.role, rule.title))),
  };
}
