import type { RuleSetting } from './rule-setting';
import { isRecord } from './values/is-record';
import { strings } from './values/strings';
import { text } from './values/text';

export function parseRuleSetting(value: unknown): RuleSetting {
  if (!isRecord(value)) {
    return String(value);
  }

  return { severity: text(value['severity'], ''), files: strings(value['files'], []) };
}
