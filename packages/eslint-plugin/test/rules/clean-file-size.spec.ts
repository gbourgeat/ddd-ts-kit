import { cleanFileSize } from '../../src/rules/clean-file-size';
import { cleanFunctionCeiling } from '../../src/rules/clean-function-ceiling';
import { cleanFunctionSize } from '../../src/rules/clean-function-size';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const lines = (count: number): string => Array.from({ length: count }, (_, index) => `step${index}();`).join('\n');
const body = (count: number): string => Array.from({ length: count }, (_, index) => `  step${index}();`).join('\n');

ruleTester.run('clean-file-size', cleanFileSize, {
  valid: [
    lines(350),
    `${lines(350)}\n`,
    at('src/platform/database/generated/client.ts', lines(400)),
    at('src/types.d.ts', lines(400)),
    at(`${BILLING}/application/application.declarations.ts`, lines(400)),
    at(`${BILLING}/billing.declarations.ts`, lines(400)),
    at('src/a.ts', lines(400), { rules: { 'clean/file-size': 'off' } }),
  ],
  invalid: [
    { code: lines(351), errors: [{ messageId: 'tooLong', line: 351, data: { count: 351, limit: 350 } }] },
    { code: `${lines(351)}\n`, errors: [{ messageId: 'tooLong', data: { count: 351, limit: 350 } }] },
    { ...at(`${BILLING}/test/unit/invoice.spec.ts`, lines(360)), errors: [{ messageId: 'tooLong' }] },
    { ...at('src/generated-client.ts', lines(351)), errors: [{ messageId: 'tooLong' }] },
    {
      ...at(`${BILLING}/application/application.declarations.spec.ts`, lines(351)),
      errors: [{ messageId: 'tooLong' }],
    },
    {
      ...at(`${BILLING}/domain/aggregates/invoice.aggregate.ts`, lines(351)),
      errors: [{ messageId: 'aggregateTooLong', data: { count: 351, limit: 350 } }],
    },
    {
      ...at('test/e2e/issue-invoice.e2e.spec.ts', lines(351)),
      errors: [{ messageId: 'e2eSpecTooLong', data: { count: 351, limit: 350 } }],
    },
  ],
});

ruleTester.run('clean-function-ceiling', cleanFunctionCeiling, {
  valid: [
    `function steps(): void {\n${body(100)}\n}`,
    `describe('an invoice', () => {\n${body(100)}\n});`,
    `function documented(): void {\n${body(100)}\n\n  // a comment is not a line of code\n}`,
    at('src/a.ts', `function steps(): void {\n${body(120)}\n}`, { rules: { 'clean/function-size': 'off' } }),
  ],
  invalid: [
    {
      code: `function steps(): void {\n${body(101)}\n}`,
      errors: [{ messageId: 'ceiling', data: { name: "Function 'steps'", count: 101, limit: 100 } }],
    },
    { code: `describe('an invoice', () => {\n${body(101)}\n});`, errors: [{ messageId: 'ceiling' }] },
    { code: `runner.describe('a contract', () => {\n${body(101)}\n});`, errors: [{ messageId: 'ceiling' }] },
    {
      ...at(`${BILLING}/billing.module.ts`, `export function register(): void {\n${body(101)}\n}`),
      errors: [{ messageId: 'ceiling' }],
    },
    {
      ...at('src/a.ts', `function steps(): void {\n${body(101)}\n}`, { limits: { maxFunctionLines: 500 } }),
      errors: [{ messageId: 'ceiling' }],
    },
  ],
});

ruleTester.run('clean-function-size, clamped at the ceiling', cleanFunctionSize, {
  valid: [
    { code: `function steps(): void {\n${body(100)}\n}`, options: [{ maxLines: 500 }] },
    at('src/a.ts', `function steps(): void {\n${body(100)}\n}`, { limits: { maxFunctionLines: 500 } }),
  ],
  invalid: [
    {
      code: `function steps(): void {\n${body(101)}\n}`,
      options: [{ maxLines: 500 }],
      errors: [{ messageId: 'lines', data: { name: "Function 'steps'", count: 101, limit: 100 } }],
    },
    {
      ...at('src/a.ts', `function steps(): void {\n${body(101)}\n}`, { limits: { maxFunctionLines: 500 } }),
      errors: [{ messageId: 'lines', data: { name: "Function 'steps'", count: 101, limit: 100 } }],
    },
  ],
});
