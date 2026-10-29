import { isRecord } from '../config/values/is-record';
import type { AcceptanceLock, Amendment, LockedScenario, LockedTest } from './acceptance-lock';

/** The lock a text holds; undefined when it is not one. */
export function lockIn(text: string, story: string): AcceptanceLock | undefined {
  try {
    const raw: unknown = JSON.parse(text);

    return isRecord(raw) ? lockOf(raw, story) : undefined;
  } catch {
    return undefined;
  }
}

function lockOf(raw: Record<string, unknown>, story: string): AcceptanceLock {
  const criteria = isRecord(raw['criteria']) ? raw['criteria'] : {};

  return {
    story,
    criteria: Object.fromEntries(
      Object.entries(criteria).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    scenarios: records(raw['scenarios']).map(
      (scenario): LockedScenario => ({
        title: text(scenario['title']),
        criteria: texts(scenario['criteria']),
        fingerprint: text(scenario['fingerprint']),
      }),
    ),
    regression: records(raw['regression']).map(
      (test): LockedTest => ({
        file: text(test['file']),
        title: text(test['title']),
        fingerprint: text(test['fingerprint']),
      }),
    ),
    amendments: records(raw['amendments']).map(
      (amendment): Amendment => ({
        subject: text(amendment['subject']),
        criteria: texts(amendment['criteria']),
        reason: text(amendment['reason']),
        verdict: text(amendment['verdict']),
        on: text(amendment['on']),
      }),
    ),
  };
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
