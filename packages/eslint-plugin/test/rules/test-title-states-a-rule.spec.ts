import { testTitleStatesARule } from '../../src/rules/test-title-states-a-rule';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const SPEC = `${BILLING}/test/unit/invoice.aggregate.spec.ts`;
const ACCEPTANCE = 'test/acceptance/us5.acceptance.spec.ts';
const SOURCE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const VITEST = "import { describe, it } from 'vitest';\n";

ruleTester.run('test-title-states-a-rule', testTitleStatesARule, {
  valid: [
    at(SPEC, `${VITEST}it('refuses to pay an invoice twice', () => {});`),
    at(SPEC, `${VITEST}it('is refused to an actor who does not hold the permission billing.invoice.issue', () => {});`),
    at(SPEC, `${VITEST}it('answers 401 to a caller who presents no credential', () => {});`),
    at(SPEC, `${VITEST}it('checks the balance before paying', () => {});`),
    at(ACCEPTANCE, `${VITEST}it('#US5.02 AC1 a customer places an order', () => {});`),
    at(ACCEPTANCE, `${VITEST}it('#US5.02 #US5.03 AC1, AC2 a customer sees the order', () => {});`),
    at(SPEC, `${VITEST}it('#FIX-412 refuses a payment above the balance', () => {});`),
    at(ACCEPTANCE, `${VITEST}it.todo('AC1 a customer places an order and reads its number');`),
    at(SPEC, `${VITEST}it.each(['a', 'b'])('%s is refused', () => {});`),
    at(SPEC, `${VITEST}it.each([{ kind: 'reminder' }])('$kind announces an appointment', () => {});`),
    at(SPEC, `${VITEST}const status = 201;\nit(\`answers \${status} to a caller\`, () => {});`),
    at(SPEC, `${VITEST}const status = 201;\nit(\`\${status} is answered\`, () => {});`),
    at(SPEC, `${VITEST}const title = 'kept in a variable';\nit(title, () => {});`),
    at(SPEC, `${VITEST}it.todo('records the fact of its birth');`),
    at(
      SPEC,
      `${VITEST}describe('Invoice', () => {});\ndescribe('Issue invoice', () => {});\ndescribe('POST /invoices', () => {});\ndescribe('When scheduling publishes scheduling.appointment.booked', () => {});\ndescribe('Issue invoice, end to end', () => {});`,
    ),
    at(SOURCE, "it('Should not be judged outside a test file', () => {});"),
  ],
  invalid: [
    {
      ...at(SPEC, `${VITEST}it('should refuse a second payment', () => {});`),
      errors: [{ messageId: 'word', data: { title: 'should refuse a second payment', word: 'should' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('pays the invoice correctly', () => {});`),
      errors: [{ messageId: 'word', data: { title: 'pays the invoice correctly', word: 'correctly' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('verifies that the invoice is saved', () => {});`),
      errors: [{ messageId: 'word', data: { title: 'verifies that the invoice is saved', word: 'verifies that' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('Refuses a second payment', () => {});`),
      errors: [{ messageId: 'rule', data: { title: 'Refuses a second payment' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('execute() saves the invoice', () => {});`),
      errors: [{ messageId: 'code', data: { title: 'execute() saves the invoice', code: 'execute()' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('issueInvoice saves the invoice', () => {});`),
      errors: [{ messageId: 'code', data: { title: 'issueInvoice saves the invoice', code: 'issueInvoice' } }],
    },
    {
      ...at(SPEC, `${VITEST}it('', () => {});\nit('#US5.02 ', () => {});\ndescribe('', () => {});`),
      errors: [{ messageId: 'empty' }, { messageId: 'empty' }, { messageId: 'empty' }],
    },
    {
      ...at(SPEC, `${VITEST}describe('Invoice tests', () => {});\ndescribe('InvoiceSpec', () => {});`),
      errors: [
        { messageId: 'group', data: { title: 'Invoice tests' } },
        { messageId: 'group', data: { title: 'InvoiceSpec' } },
      ],
    },
  ],
});
