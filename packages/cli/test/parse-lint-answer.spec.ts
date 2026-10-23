import { describe, expect, it } from 'vitest';
import { parseLintAnswer } from '../src/lint/parse-lint-answer';

describe('the answer of the process that runs ESLint', () => {
  it('is not one without a report or a list of messages', () => {
    expect(parseLintAnswer('[]')).toBeUndefined();
    expect(parseLintAnswer(JSON.stringify({ report: 3, messages: [] }))).toBeUndefined();
    expect(parseLintAnswer(JSON.stringify({ report: '', messages: {} }))).toBeUndefined();
  });

  it('reads each message, an unknown rule and severity read as no rule and an error', () => {
    const output = JSON.stringify({
      report: 'src/a.ts: 2 problems',
      messages: [{ ruleId: 'no-console', severity: 1 }, { ruleId: null }, 'not a message'],
      transitions: { 'ddd-ts-kit/clean-file-size': '1.0.0', 'ddd-ts-kit/other': 2 },
    });

    expect(parseLintAnswer(output)).toEqual({
      report: 'src/a.ts: 2 problems',
      messages: [
        { ruleId: 'no-console', severity: 1 },
        { ruleId: null, severity: 2 },
      ],
      transitions: { 'ddd-ts-kit/clean-file-size': '1.0.0' },
    });
  });

  it('reads no rule in transition when the answer gives none', () => {
    expect(parseLintAnswer(JSON.stringify({ report: '', messages: [], transitions: 'none' }))?.transitions).toEqual({});
  });
});
