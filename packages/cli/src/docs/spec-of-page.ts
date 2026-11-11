import { allRules } from './all-rules';
import { isGeneratedTitle } from './is-generated-title';
import type { SpecOfPage } from './page-section';
import type { SpecRules } from './rules-in';
import { specSubject } from './spec-subject';

/**
 * A spec as a page reads it: its subject, and the rules whose title a template of the kit wrote, each read once.
 * `readAs` names a spec of the test folder of a module with the module below the folder of its kind
 * (`calendars/test/unit/slot.vo.spec.ts` is read as `unit/calendars/slot.vo.spec.ts`): its section is the one of
 * its kind and its heading names its module, and `file` says where it is.
 */
export function specOfPage(file: string, rules: SpecRules, readAs = file): SpecOfPage {
  const subject = specSubject(readAs);

  return {
    file,
    rules,
    subject,
    generated: new Set(allRules(rules).filter((rule) => isGeneratedTitle(subject.role, rule.title))),
  };
}
