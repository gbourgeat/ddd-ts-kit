import { testNoOnlyNoSkip } from '../../src/rules/test-no-only-no-skip';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { describe, it, test } from 'vitest';\n";

ruleTester.run('test-no-only-no-skip', testNoOnlyNoSkip, {
  valid: [
    at(
      SPEC,
      `${VITEST}describe('Invoice', () => { it('records the payment', () => {}); it.todo('refuses a second payment'); it.each([1])('accepts %s', () => {}); test.concurrent('runs', () => {}); });`,
    ),
    at(SPEC, "const it = { only: (title: string) => title }; it.only('a local, not the runner');"),
    at(SPEC, `${VITEST}describe.runIf(process.env['VARNISH_URL'] !== undefined)('Through Varnish', () => {});`),
    at(
      SPEC,
      `${VITEST}const THROUGH_VARNISH = process.env['VARNISH_URL'] !== '';\nit.skipIf(!THROUGH_VARNISH)('serves the cached hours', () => {});`,
    ),
    at(SPEC, `${VITEST}it.runIf.concurrent('records the payment', () => {});`),
    at(SOURCE, "it.only('not a test file', () => {});"),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it.only('records the payment', () => {});`),
      errors: [{ messageId: 'modifier', data: { what: 'it.only' } }],
    },
    {
      ...at(SPEC, `${VITEST}describe.skip('Invoice', () => {});`),
      errors: [{ messageId: 'modifier', data: { what: 'describe.skip' } }],
    },
    {
      ...at(SPEC, `${VITEST}test.skipIf(true)('records the payment', () => {});`),
      errors: [{ messageId: 'constant', data: { what: 'test.skipIf' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}describe.runIf(false)('Invoice', () => {});\nit.skipIf()('records the payment', () => {});`,
      ),
      errors: [
        { messageId: 'constant', data: { what: 'describe.runIf' } },
        { messageId: 'constant', data: { what: 'it.skipIf' } },
      ],
    },
    {
      ...at(SPEC, `${VITEST}it.concurrent.only('records the payment', () => {});`),
      errors: [{ messageId: 'modifier', data: { what: 'it.only' } }],
    },
    {
      ...at(SPEC, "xit('records the payment', () => {});\nfdescribe('Invoice', () => {});"),
      errors: [
        { messageId: 'prefixed', data: { what: 'xit' } },
        { messageId: 'prefixed', data: { what: 'fdescribe' } },
      ],
    },
  ],
});
