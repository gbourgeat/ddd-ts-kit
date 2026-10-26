import assert from 'node:assert/strict';
import { test } from 'node:test';
import { difference, eslintFindings, oxlintFindings, report, ruleOfEslint, ruleOfOxlint } from './compare-linters.mjs';

test('a rule has one name in both tools', () => {
  assert.equal(ruleOfEslint('@typescript-eslint/no-floating-promises'), 'no-floating-promises');
  assert.equal(ruleOfEslint('ddd-ts-kit/clean-stepdown'), 'ddd-ts-kit/clean-stepdown');
  assert.equal(ruleOfEslint(null), 'fatal');
  assert.equal(ruleOfOxlint('typescript(no-floating-promises)'), 'no-floating-promises');
  assert.equal(ruleOfOxlint('eslint(no-empty)'), 'no-empty');
  assert.equal(ruleOfOxlint('ddd-ts-kit(clean-stepdown)'), 'ddd-ts-kit/clean-stepdown');
  assert.equal(ruleOfOxlint('@stylistic(curly)'), '@stylistic/curly');
  assert.equal(ruleOfOxlint(undefined), 'fatal');
});

test('the findings of each tool are read as file, line and rule, relative to the root', () => {
  const eslint = [
    { filePath: '/repo/src/a.ts', messages: [{ ruleId: '@typescript-eslint/no-explicit-any', line: 3 }] },
    { filePath: '/repo/src/b.ts', messages: [{ ruleId: null, line: 1 }] },
  ];
  const oxlint = {
    diagnostics: [
      {
        code: 'typescript(no-explicit-any)',
        filename: 'file:///repo/src/a.ts',
        labels: [{ span: { line: 3 } }],
      },
    ],
  };

  assert.deepEqual(eslintFindings(eslint, '/repo'), ['src/a.ts:3 no-explicit-any', 'src/b.ts:1 fatal']);
  assert.deepEqual(oxlintFindings(oxlint, '/repo'), ['src/a.ts:3 no-explicit-any']);
});

test('the difference counts what only one side reports, a repeated finding included', () => {
  const result = difference(['a:1 r', 'b:2 s', 'b:2 s'], ['a:1 r', 'b:2 s', 'c:3 t']);

  assert.deepEqual(result, {
    eslint: 3,
    oxlint: 3,
    same: 2,
    eslintOnly: ['b:2 s'],
    oxlintOnly: ['c:3 t'],
  });
});

test('the report names the differences, and sets apart what Oxlint cannot report', () => {
  const text = report(difference(['a:1 no-unsafe-enum-assignment', 'b:2 s'], ['c:3 t']));

  assert.match(text, /\| 2 \| 1 \| 0 \| 1 \| 1 \| 1 \|/);
  assert.match(text, /### ESLint only\n\n```\nb:2 s\n```/);
  assert.match(text, /### Oxlint only\n\n```\nc:3 t\n```/);
  assert.match(text, /### Expected, ESLint only\n\n```\na:1 no-unsafe-enum-assignment\n```/);
});

test('no difference gives a report without a list', () => {
  const text = report(difference(['a:1 r'], ['a:1 r']));

  assert.doesNotMatch(text, /###/);
  assert.match(text, /\| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \|/);
});
