import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli } from '../helpers';
import { EditedProject } from './edited-project';
import { SLOW } from './stacks';

const BILLING = 'src/contexts/billing';
const CODES = `${BILLING}/domain/errors/codes.ts`;
const VOIDED = `${BILLING}/domain/errors/invoice-voided.error.ts`;
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const ROUTE = `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`;
const CLASS = 'export class InvoiceVoided extends DomainRefusal {\n';

const AD_HOC =
  "\nimport { InvoiceVoided } from '@/contexts/billing/domain/errors/invoice-voided.error';\n\nexport const adHoc = (): unknown => new InvoiceVoided('ad hoc');\n";

/**
 * Two refusals of billing in the form `init` writes, `"stack.refusals": "named"`: a class each, their
 * codes listed in codes.ts, each named in the glossary of billing, which learns the word it lacks.
 */
function refusalsOfBilling(root: string): void {
  const refusals = [
    ['InvoiceVoided', 'Void=To withdraw an invoice once issued'],
    ['InvoicePaid', 'Pay=To settle an invoice'],
  ];

  for (const [refusal = '', term = ''] of refusals) {
    expect(cli(root, 'generate', 'error', 'billing', refusal, 'forInvoice', '--term', term, '--json').code).toBe(0);
  }
}

/** Slow, opt-in (DDD_TS_KIT_E2E=1): one deliberate violation per `errors/*` rule, caught by the tool that holds it. */
describe.runIf(SLOW)('a violation of an errors rule, written into a generated project', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate(refusalsOfBilling);
  }, 120_000);

  afterEach(() => {
    project.restore();
  });

  it('is absent from the generated refusal classes, their code list, their users and the route', () => {
    expect(project.linted(VOIDED, CODES, SERVICE, ROUTE)).toBe('');
    expect(project.checkedRules()).toEqual([]);
  }, 120_000);

  it('ESLint catches a refusal built with new outside its class (errors/through-factory)', () => {
    project.append(SERVICE, AD_HOC);

    expect(project.linted(SERVICE)).toContain('ddd-ts-kit/errors-through-factory');
  }, 120_000);

  it('ESLint catches a public constructor on a refusal class (errors/constructor-not-public)', () => {
    project.edit(VOIDED, CLASS, `${CLASS}  public constructor() {\n    super('ad hoc');\n  }\n\n`);

    expect(project.linted(VOIDED)).toContain('ddd-ts-kit/errors-constructor-not-public');
  }, 120_000);

  it('ESLint catches a factory named without a prefix (errors/factory-name)', () => {
    project.edit(VOIDED, 'static forInvoice(', 'static voided(');

    expect(project.linted(VOIDED)).toContain('ddd-ts-kit/errors-factory-name');
  }, 120_000);

  it('the checker catches a refusal class that writes its code instead of reading it from the list (errors/code-listed)', () => {
    project.edit(VOIDED, 'readonly code = BillingCodes.InvoiceVoided;', "readonly code = 'INVOICE_VOIDED';");

    expect(project.checkedRules()).toEqual(['errors/code-listed']);
  }, 120_000);

  it('the checker catches two refusals of a context under one code (errors/code-unique)', () => {
    project.edit(CODES, "InvoicePaid: 'INVOICE_PAID'", "InvoicePaid: 'INVOICE_VOIDED'");

    expect(project.checkedRules()).toContain('errors/code-unique');
  }, 120_000);

  it('the checker catches a route declaring a code no refusal sets (errors/known-code)', () => {
    project.edit(ROUTE, 'errors: [', "errors: ['INVOICE_CANCELLED', ");

    expect(project.checkedRules()).toContain('errors/known-code');
  }, 120_000);
});
