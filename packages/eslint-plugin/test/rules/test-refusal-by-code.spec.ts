import { testRefusalByCode } from '../../src/rules/test-refusal-by-code';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const PLATFORM_SPEC = 'src/platform/config/read-config.spec.ts';
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { expect, it } from 'vitest';\n";

ruleTester.run('test-refusal-by-code', testRefusalByCode, {
  valid: [
    at(SPEC, `${VITEST}it('accepts a first payment', () => { expect(() => invoice.pay(at)).not.toThrow(); });`),
    at(
      SPEC,
      `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrow(expect.objectContaining({ code: 'INVOICE_ALREADY_PAID' })); });`,
    ),
    at(
      SPEC,
      `${VITEST}it('refuses a second payment', async () => { await expect(bus.execute(command)).rejects.toThrowError({ code: 'INVOICE_ALREADY_PAID' }); });`,
    ),
    at(
      SPEC,
      `${VITEST}it('refuses a second payment', async () => { await expect(bus.execute(command)).rejects.toMatchObject({ code: 'INVOICE_ALREADY_PAID' }); });`,
    ),
    at(
      PLATFORM_SPEC,
      `${VITEST}it('refuses a port that is not a number', () => { expect(() => readConfig(env)).toThrow('PORT'); });`,
    ),
    at(
      `${BILLING}/test/unit/environment-payment-connection.adapter.spec.ts`,
      `${VITEST}it('names the variable that is missing', async () => { await expect(connection.settings()).rejects.toThrow('STRIPE_KEY is not set'); });`,
    ),
    at(
      `${BILLING}/test/integration/stripe-payment-gateway.spec.ts`,
      `${VITEST}it('fails when Stripe refuses the call', async () => { await expect(gateway.charge(invoice)).rejects.toThrow('Stripe answered 402'); });`,
    ),
    at(SOURCE, "expect(() => invoice.pay(at)).toThrow('not a test file');"),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it('refuses an empty value', () => { expect(() => Email.create(' ')).toThrow(); });`),
      errors: [{ messageId: 'by', data: { matcher: 'toThrow', by: 'nothing' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrow('already paid'); });`,
      ),
      errors: [{ messageId: 'by', data: { matcher: 'toThrow', by: 'its message' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrow(/already paid/); });`,
      ),
      errors: [{ messageId: 'by', data: { matcher: 'toThrow', by: 'its message' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', async () => { await expect(bus.execute(command)).rejects.toThrowError(\`already \${state}\`); });`,
      ),
      errors: [{ messageId: 'by', data: { matcher: 'toThrowError', by: 'its message' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrow(InvoiceAlreadyPaid); });`,
      ),
      errors: [{ messageId: 'by', data: { matcher: 'toThrow', by: 'its class' } }],
    },
    {
      ...at(
        SPEC,
        `${VITEST}it('refuses a second payment', () => { expect(() => invoice.pay(at)).toThrow(new Error('already paid')); });`,
      ),
      errors: [{ messageId: 'by', data: { matcher: 'toThrow', by: 'its class' } }],
    },
  ],
});
