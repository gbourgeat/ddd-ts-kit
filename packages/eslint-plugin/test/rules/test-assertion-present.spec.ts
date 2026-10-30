import { testAssertionPresent } from '../../src/rules/test-assertion-present';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const E2E = 'test/e2e/issue-invoice.e2e.spec.ts';
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { expect, it } from 'vitest';\n";

ruleTester.run('test-assertion-present', testAssertionPresent, {
  valid: [
    at(SPEC, `${VITEST}it('records the payment', () => { expect(events).toEqual([]); });`),
    at(
      SPEC,
      `${VITEST}it('refuses an empty value', () => { expectRefusal(() => Email.create(' '), 'INVALID_EMAIL'); });`,
    ),
    at(
      SPEC,
      `${VITEST}it('records the payment', () => { given(anInvoice()).when((invoice) => invoice.pay(at)).thenEvents([{ name: 'billing.invoice.paid' }]); });`,
    ),
    at(
      SPEC,
      `${VITEST}it('refuses a second payment', () => { given(anInvoice().paid()).when((invoice) => invoice.pay(at)).thenError('INVOICE_ALREADY_PAID'); });`,
    ),
    at(SPEC, `${VITEST}it('holds its lines', () => { expect.soft(count()).toBe(2); });`),
    at(
      SPEC,
      `${VITEST}import fc from 'fast-check';\nit('overlaps in both directions, for any two slots', () => { fc.assert(fc.property(slots, slots, (one, other) => one.overlaps(other) === other.overlaps(one))); });`,
    ),
    at(E2E, `${VITEST}it('answers 201', async () => { expectStatus(await client.post('/invoices', body), 201); });`),
    at(SPEC, `${VITEST}it('keeps the invoice', async () => { await assertSaved(repository, 'invoice-1'); });`),
    at(SPEC, `${VITEST}it.todo('refuses a second payment');`),
    at(
      E2E,
      `${VITEST}it('#US5.02 AC1 a customer places an order', pending(async () => { expectStatus(await order(), 201); }));`,
    ),
    at(SPEC, `${VITEST}const title = 'kept in a variable';\nit(title, () => { expect(1).toBe(1); });`),
    at(SOURCE, "it('not a test file', () => { run(); });"),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it('records the payment', () => { pay(); });`),
      errors: [{ messageId: 'none', data: { title: 'records the payment' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('issues the invoice', async () => { await bus.execute(command); });`),
      errors: [{ messageId: 'none', data: { title: 'issues the invoice' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('announces the payment', () => { promise.then(() => done()); });`),
      errors: [{ messageId: 'none', data: { title: 'announces the payment' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('records the payment', () => { pay()(); });`),
      errors: [{ messageId: 'none', data: { title: 'records the payment' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('refuses a second payment');`),
      errors: [{ messageId: 'pending', data: { title: 'refuses a second payment' } }],
    },
  ],
});
