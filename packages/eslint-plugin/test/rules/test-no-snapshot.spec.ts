import { testNoSnapshot } from '../../src/rules/test-no-snapshot';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { expect, it } from 'vitest';\n";

ruleTester.run('test-no-snapshot', testNoSnapshot, {
  valid: [
    at(SPEC, `${VITEST}it('keeps its lines', () => { expect(invoice.toState()).toEqual({ lines: [] }); });`),
    at(SPEC, `${VITEST}it('keeps its lines', () => { expect(invoice.toState()).toMatchObject({ lines: [] }); });`),
    at(SOURCE, 'expect(invoice).toMatchSnapshot();'),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it('keeps its lines', () => { expect(invoice.toState()).toMatchSnapshot(); });`),
      errors: [{ messageId: 'snapshot', data: { matcher: 'toMatchSnapshot' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('keeps its lines', () => { expect(invoice.toState()).toMatchInlineSnapshot(); });`),
      errors: [{ messageId: 'snapshot', data: { matcher: 'toMatchInlineSnapshot' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrowErrorMatchingInlineSnapshot(); });`,
      ),
      errors: [{ messageId: 'snapshot', data: { matcher: 'toThrowErrorMatchingInlineSnapshot' } }],
    },
  ],
});
