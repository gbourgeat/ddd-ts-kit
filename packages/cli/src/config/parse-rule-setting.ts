import type { RuleSetting } from './rule-setting.js';
import { isRecord } from './values/is-record.js';
import { strings } from './values/strings.js';
import { text } from './values/text.js';

export function parseRuleSetting(value: unknown): RuleSetting {
  if (!isRecord(value)) {
    return String(value);
  }

  return { severity: text(value['severity'], ''), files: strings(value['files'], []) };
}
