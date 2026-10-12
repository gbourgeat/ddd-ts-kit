import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EditedProject } from './edited-project.js';
import { SLOW } from './stacks.js';

const BILLING = 'src/contexts/billing';
const ERROR = `${BILLING}/domain/errors/invoice.error.ts`;
const SERVICE = `${BILLING}/domain/services/pricing.service.ts`;
const ROUTE = `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`;
const CLASS = 'export class InvoiceError extends ConceptError {\n';

const AD_HOC =
  "\nimport { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';\n\nexport const adHoc = (): unknown => new InvoiceError('ANY', 'ad hoc', {});\n";

const TWICE =
  "  static issuedTwice() {\n    return InvoiceError.refusal('INVOICE_ALREADY_ISSUED', 'Issued twice.');\n  }\n\n";

/** Slow, opt-in (DDD_TS_KIT_E2E=1): one deliberate violation per `errors/*` rule, caught by the tool that holds it. */
describe.runIf(SLOW)('a violation of an errors rule, written into a generated project', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate();
  }, 120_000);

  afterEach(() => {
    project.restore();
  });

  it('is absent from the generated error class, its users and its route', () => {
    expect(project.linted(ERROR, SERVICE, ROUTE)).toBe('');
    expect(project.checkedRules()).toEqual([]);
  }, 120_000);

  it('ESLint catches a refusal built with new outside its class (errors/through-factory)', () => {
    project.append(SERVICE, AD_HOC);

    expect(project.linted(SERVICE)).toContain('ddd-ts-kit/errors-through-factory');
  }, 120_000);

  it('ESLint catches a public constructor on an error class (errors/constructor-not-public)', () => {
    project.edit(ERROR, CLASS, `${CLASS}  public constructor() {\n    super('ANY', 'ad hoc', {});\n  }\n\n`);

    expect(project.linted(ERROR)).toContain('ddd-ts-kit/errors-constructor-not-public');
  }, 120_000);

  it('ESLint catches a factory whose code says something else (errors/factory-name)', () => {
    project.edit(ERROR, "'INVOICE_ALREADY_ISSUED'", "'BILLING_FAILED'");

    expect(project.linted(ERROR)).toContain('ddd-ts-kit/errors-factory-name');
  }, 120_000);

  it('the checker catches two refusals of a context under one code (errors/code-unique)', () => {
    project.edit(ERROR, CLASS, `${CLASS}${TWICE}`);

    expect(project.checkedRules()).toContain('errors/code-unique');
  }, 120_000);

  it('the checker catches a route declaring a code no refusal sets (errors/known-code)', () => {
    project.edit(ROUTE, 'errors: [', "errors: ['INVOICE_VOIDED', ");

    expect(project.checkedRules()).toContain('errors/known-code');
  }, 120_000);
});
