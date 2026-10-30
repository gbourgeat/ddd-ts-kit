import { describe, expect, it } from 'vitest';
import { rules } from '../../src';
import { docsOf } from '../../src/support/rule/docs-of';

describe('docsOf', () => {
  it('answers the documentation defineRule wrote', () => {
    expect(Object.values(rules).map((rule) => docsOf(rule).ruleId)).toContain('clean/no-hash-private');
  });

  it('refuses a rule that defineRule did not make', () => {
    const bare = {
      meta: { type: 'problem' as const, messages: {}, schema: [] },
      defaultOptions: [],
      create: () => ({}),
    };

    expect(() => docsOf(bare)).toThrow('has no meta.docs');
  });
});
