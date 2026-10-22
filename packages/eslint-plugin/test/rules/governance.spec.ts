import { TSESLint } from '@typescript-eslint/utils';
import { describe, expect, it } from 'vitest';
import plugin from '../../src';
import { governanceRecordedDeviation } from '../../src/rules/governance-recorded-deviation';
import { ruleTester } from '../support/rule-tester';

ruleTester.run('governance-recorded-deviation', governanceRecordedDeviation, {
  valid: [
    '// eslint-disable-next-line no-console -- ADR-0012: the CLI prints its result\nconsole.log(result);',
    '/* eslint-disable no-console, no-alert -- ADR-3: this file is the logger */',
    'console.log(result); // eslint-disable-line no-console -- see ADR-0012',
    '// ddd-ts-kit-disable-next-line layer/domain-purity -- ADR-0004: hashing is pure\nimport { createHash } from "node:crypto";',
    '/* eslint-enable no-console */',
    '// eslint-disabled is not a directive\n// talks about eslint-disable in prose',
    '// ddd-ts-kit-disable-next-line governance/recorded-deviation -- ADR-0001: generated file\n// eslint-disable-next-line no-console -- generated\nconsole.log(1);',
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line no-console -- the CLI prints its result\nconsole.log(result);',
      errors: [
        { messageId: 'unrecorded', line: 1, data: { directive: 'eslint-disable-next-line no-console', line: 1 } },
      ],
    },
    { code: '// eslint-disable-next-line no-console\nconsole.log(result);', errors: [{ messageId: 'unrecorded' }] },
    { code: 'foo();\n/* eslint-disable no-console -- ADR pending */', errors: [{ messageId: 'unrecorded', line: 2 }] },
    {
      code: '// ddd-ts-kit-disable-next-line layer/domain-purity -- hashing is pure\nimport { createHash } from "node:crypto";',
      errors: [
        { messageId: 'unrecorded', data: { directive: 'ddd-ts-kit-disable-next-line layer/domain-purity', line: 1 } },
      ],
    },
    {
      code: '// eslint-disable-next-line -- ADR-0002: legacy\nconsole.log(result);',
      errors: [{ messageId: 'blanket', line: 1, data: { directive: 'eslint-disable-next-line', line: 1 } }],
    },
    { code: '// ddd-ts-kit-disable-next-line\nconsole.log(result);', errors: [{ messageId: 'blanket' }] },
  ],
});

describe('governance-recorded-deviation against the directives that silence it', () => {
  const linter = new TSESLint.Linter({ configType: 'flat' });

  const lint = (code: string): string[] =>
    linter
      .verify(code, [
        {
          plugins: { 'ddd-ts-kit': plugin },
          linterOptions: { reportUnusedDisableDirectives: 'off' },
          rules: { 'ddd-ts-kit/governance-recorded-deviation': 'error', 'no-console': 'error' },
        },
      ])
      .map(
        (message) => `${message.line}:${message.ruleId === 'no-console' ? 'no-console' : (message.messageId ?? '')}`,
      );

  it('reports a blanket eslint-disable at the top of a file', () => {
    expect(lint('/* eslint-disable */\nconsole.log(1);')).toEqual(['1:blanket']);
  });

  it('reports a blanket eslint-disable further down, with or without a decision record', () => {
    expect(lint('console.log(1);\n/* eslint-disable -- ADR-0001: legacy */\nconsole.log(2);')).toEqual([
      '1:blanket',
      '1:no-console',
    ]);
  });

  it('reports a range that names this very rule', () => {
    expect(lint('/* eslint-disable ddd-ts-kit/governance-recorded-deviation, no-console */\nconsole.log(1);')).toEqual([
      '1:unrecorded',
    ]);
  });

  it('reports a blanket eslint-disable-line on the line above', () => {
    expect(lint('const a = 1;\nconsole.log(a); // eslint-disable-line')).toEqual(['1:blanket']);
  });

  it('leaves alone a recorded suppression of this rule', () => {
    expect(
      lint(
        '/* eslint-disable ddd-ts-kit/governance-recorded-deviation -- ADR-0009: vendored file */\n// eslint-disable-next-line no-console\nconsole.log(1);',
      ),
    ).toEqual([]);
  });
});
