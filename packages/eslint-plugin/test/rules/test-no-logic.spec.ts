import { testNoLogic } from '../../src/rules/test-no-logic';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { beforeEach, describe, expect, it } from 'vitest';\n";

ruleTester.run('test-no-logic', testNoLogic, {
  valid: [
    at(SPEC, `${VITEST}it('records the payment', () => { expect(pay()).toEqual([]); });`),
    at(
      SPEC,
      `${VITEST}it('records the payment', () => { expect(paid()).toBe(true); });\nfunction paid(): boolean { if (Math.random() > 0.5) { return true; } return false; }`,
    ),
    at(
      SPEC,
      `${VITEST}describe('Invoice', () => { beforeEach(() => { for (const line of lines) { add(line); } }); it('holds its lines', () => { expect(count()).toBe(2); }); });`,
    ),
    at(SPEC, `${VITEST}it.each([1, 2])('accepts %s', (value) => { expect(value).toBeGreaterThan(0); });`),
    at(SPEC, `${VITEST}it('#US5.02 AC1 a customer places an order', pending(async () => { expect(1).toBe(1); }));`),
    at(SOURCE, "it('not a test file', () => { if (a) { b(); } });"),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it('records the payment', () => { if (paid) { expect(events).toEqual([]); } });`),
      errors: [{ messageId: 'logic', data: { what: 'An `if`' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('accepts every kind', () => { for (const kind of kinds) { expect(accepts(kind)).toBe(true); } });`,
      ),
      errors: [{ messageId: 'logic', data: { what: 'A `for`' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('answers the total', () => { expect(total).toBe(paid ? 10 : 0); });`),
      errors: [{ messageId: 'logic', data: { what: 'A ternary' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { try { pay(); } catch (error) { expect(error).toBeDefined(); } });`,
      ),
      errors: [{ messageId: 'logic', data: { what: 'A `try`' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('#US5.02 AC1 a customer places an order', pending(async () => { while (pending()) { await tick(); } }));`,
      ),
      errors: [{ messageId: 'logic', data: { what: 'A `while`' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('announces the payment', () => { bus.on('paid', (event) => { switch (event.kind) { default: expect(event).toBeDefined(); } }); });`,
      ),
      errors: [{ messageId: 'logic', data: { what: 'A `switch`' } }],
    },
  ],
});
