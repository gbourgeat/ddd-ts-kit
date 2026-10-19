import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers.js';
import { failure, report } from './reports.js';
import { billingProject as project, generateError as generate } from './support/billing-error-project.js';

const CODES = 'src/contexts/billing/domain/errors/codes.ts';
const ISSUED = 'src/contexts/billing/domain/errors/invoice-already-issued.error.ts';
const ISSUED_SPEC = 'src/contexts/billing/test/unit/invoice-already-issued.error.spec.ts';
const PAYMENT_TERMS = ['--term', 'Payment=Money paid against an invoice', '--term', 'Late=Past its due date'];

describe('generate error, in a project of one class per refusal ("stack.refusals": "named")', () => {
  let root: string;

  beforeAll(() => {
    root = project('named');
  });

  it('is the form init records by default', () => {
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { refusals: 'named' } });
  });

  it('creates the list of codes of the context, the class of the refusal with its factory, and the spec', () => {
    const created = report(generate(root, 'InvoiceAlreadyIssued', 'forInvoice'));

    expect(created.created).toEqual([CODES, ISSUED, ISSUED_SPEC]);

    expect(read(root, CODES)).toContain(
      "export const BillingCodes = {\n  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n} as const;",
    );

    expect(read(root, CODES)).toContain('export type BillingCode = (typeof BillingCodes)[keyof typeof BillingCodes];');

    const [, , , , , , todo, ...rest] = read(root, ISSUED).split('\n');

    expect(read(root, ISSUED).split('\n').slice(0, 6)).toEqual([
      "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
      "import { BillingCodes } from '@/contexts/billing/domain/errors/codes';",
      '',
      'export class InvoiceAlreadyIssued extends DomainRefusal {',
      '  readonly code = BillingCodes.InvoiceAlreadyIssued;',
      '',
    ]);

    expect(todo).toBe('  static forInvoice() {');
    expect(rest[0]).toContain('// TODO(domain): take as parameters what `forInvoice` names and the facts');

    expect(rest.slice(1)).toEqual([
      "    return InvoiceAlreadyIssued.refusal('Invoice already issued.');",
      '  }',
      '}',
      '',
    ]);

    expect(read(root, ISSUED_SPEC)).toContain(
      "import { InvoiceAlreadyIssued } from '@/contexts/billing/domain/errors/invoice-already-issued.error';",
    );

    expect(read(root, ISSUED_SPEC)).toContain('const error = InvoiceAlreadyIssued.forInvoice();');
    expect(read(root, ISSUED_SPEC)).toContain('expect(error).toBeInstanceOf(DomainRefusal);');
    expect(read(root, ISSUED_SPEC)).toContain("expect(error.code).toBe('INVOICE_ALREADY_ISSUED');");
  });

  it('adds a factory to the class and its case to the spec, the code listed once', () => {
    const added = report(generate(root, 'InvoiceAlreadyIssuedError', 'with-issue-date'));
    const source = read(root, ISSUED);

    // The reference of CONTEXT.md gains the row of the new factory.
    expect(added.updated).toEqual([ISSUED, ISSUED_SPEC, 'src/contexts/billing/CONTEXT.md']);
    expect(source.indexOf('static forInvoice()')).toBeLessThan(source.indexOf('static withIssueDate()'));
    expect(source).toContain("return InvoiceAlreadyIssued.refusal('Invoice already issued.');\n  }\n}\n");
    expect(read(root, ISSUED_SPEC).match(/^ {2}it\(/gm)).toHaveLength(2);
    expect(read(root, CODES).match(/INVOICE_ALREADY_ISSUED/g)).toHaveLength(1);
  });

  it('lists a new refusal after the others, under the code given with --code, its words added with --term', () => {
    expect(generate(root, 'PaymentLate', 'onDate', '--code', 'LATE_PAYMENT', ...PAYMENT_TERMS).code).toBe(0);

    expect(read(root, CODES)).toContain(
      "  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  PaymentLate: 'LATE_PAYMENT',\n} as const;",
    );

    expect(read(root, 'src/contexts/billing/domain/errors/payment-late.error.ts')).toContain(
      'readonly code = BillingCodes.PaymentLate;',
    );
  });

  it('changes nothing when the refusal and its factory are already there, its code kept', () => {
    const files = [CODES, ISSUED, ISSUED_SPEC];
    const before = files.map((file) => read(root, file));
    const again = report(generate(root, 'InvoiceAlreadyIssued', 'forInvoice'));
    const listed = report(generate(root, 'PaymentLate', 'onDate'));

    expect([...again.created, ...again.updated, ...listed.created, ...listed.updated]).toEqual([]);
    expect(files.map((file) => read(root, file))).toEqual(before);
  });

  it('keeps an entry a list written by hand has, with or without its last comma', () => {
    write(root, CODES, "export const BillingCodes = {\n  PaymentLate: 'LATE_PAYMENT'\n} as const;\n");

    expect(generate(root, 'InvoiceAlreadyIssued', 'forInvoice').code).toBe(0);

    expect(read(root, CODES)).toBe(
      "export const BillingCodes = {\n  PaymentLate: 'LATE_PAYMENT',\n  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n} as const;\n",
    );
  });

  it('produces what the checker accepts', () => {
    const checked = cli(root, 'check', '--json').json() as { violations: { ruleId: string; file: string }[] };

    expect(checked.violations.filter(({ file }) => file.includes('error') || file.endsWith('codes.ts'))).toEqual([]);
  });
});

describe('generate error, in a project of one class per refusal, refused', () => {
  let root: string;

  beforeAll(() => {
    root = project('named-refused');
    expect(generate(root, 'InvoiceAlreadyIssued', 'forInvoice').code).toBe(0);
    expect(generate(root, 'PaymentLate', 'onDate', '--code', 'LATE_PAYMENT', ...PAYMENT_TERMS).code).toBe(0);
  });

  it('refuses a factory that does not say what the refusal is about, with the name it could have', () => {
    const unprefixed = failure(generate(root, 'InvoiceVoided', 'voided'));

    expect(unprefixed.message).toBe('"voided" does not say what the refusal is about.');
    expect(unprefixed.fix).toContain('forVoided');
    expect(failure(generate(root, 'InvoiceVoided', 'once')).fix).toContain('forOnce');
    expect(failure(generate(root, 'InvoiceVoided', 'forInvoice2')).message).toContain('is not the name of a factory');
    expect(exists(root, 'src/contexts/billing/domain/errors/invoice-voided.error.ts')).toBe(false);
  });

  it('refuses a class that says an error is built, and a code taken, malformed, of the kit or other than the listed one', () => {
    expect(failure(generate(root, 'Error', 'forInvoice')).message).toContain('says that an error is built');

    expect(failure(generate(root, 'PaymentOverdue', 'forInvoice', '--code', 'LATE_PAYMENT')).message).toBe(
      `The code "LATE_PAYMENT" is already set in ${CODES}, by PaymentLate.`,
    );

    expect(failure(generate(root, 'PaymentOverdue', 'forInvoice', '--code', 'late')).message).toContain(
      'is not a valid error code',
    );

    expect(failure(generate(root, 'NotFound', 'forInvoice')).fix).toContain('UnknownInvoice');

    expect(failure(generate(root, 'PaymentLate', 'onDate', '--code', 'PAYMENT_LATE')).message).toBe(
      `PaymentLate already sets the code "LATE_PAYMENT" in ${CODES}.`,
    );
  });

  it('refuses a list of codes that does not declare the list of its context', () => {
    write(root, 'src/contexts/billing/domain/errors/codes.ts', 'export const Codes = {} as const;\n');

    expect(failure(generate(root, 'InvoiceVoided', 'forInvoice')).message).toBe(
      `${CODES} does not declare the list BillingCodes.`,
    );

    write(
      root,
      CODES,
      "export const BillingCodes = {\n  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  PaymentLate: 'LATE_PAYMENT',\n} as const;\n",
    );
  });

  it('sends the class per error to the named form', () => {
    const refused = failure(cli(root, 'generate', 'domain-error', 'billing', 'InvoiceVoided', '--json'));

    expect(refused.message).toContain('"stack.refusals": "named"');
    expect(refused.fix).toContain('ddd-ts-kit generate error billing <Refusal> <factory>');
  });

  it('judges the words of the class against the glossary, the qualifiers of a refusal aside', () => {
    const gone = failure(generate(root, 'InvoiceVoided', 'forInvoice'));

    expect(gone.message).toBe(
      '"InvoiceVoided" uses "voided", which the glossary of src/contexts/billing/CONTEXT.md does not define.',
    );

    expect(gone.fix).toContain('or a qualifier of a refusal (invalid, unknown, already, too, no, missing, required)');
    expect(gone.fix).toContain('--term "Voided=<what it means for the business>"');
    expect(failure(generate(root, 'BadInput', 'forInvoice')).message).toContain('uses "bad", "input"');
    expect(exists(root, 'src/contexts/billing/domain/errors/invoice-voided.error.ts')).toBe(false);

    for (const refusal of [
      'InvalidInvoice',
      'UnknownInvoice',
      'InvoiceTooLate',
      'NoPaymentRequired',
      'MissingInvoice',
    ]) {
      expect(generate(root, refusal, 'forInvoice').code, refusal).toBe(0);
    }

    expect(generate(root, 'InvoiceVoided', 'forInvoice', '--term', 'Void=To cancel an invoice issued').code).toBe(0);
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('| Void | To cancel an invoice issued |');
  });
});

describe('the code generated around a refusal, in the form of the project', () => {
  const FILES = {
    aggregate: 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
    entity: 'src/contexts/billing/domain/entities/invoice-line.entity.ts',
    value: 'src/contexts/billing/domain/value-objects/money.vo.ts',
    handler: 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts',
    machine: 'src/contexts/billing/domain/state-machines/invoice.state-machine.ts',
  };

  const generateAround = (root: string): void => {
    const steps = [
      ['aggregate', 'Invoice'],
      ['entity', 'InvoiceLine', '--term', 'Line=One billed item of an invoice'],
      ['value-object', 'Money', '--term', 'Money=An amount in a currency'],
      ['command', 'IssueInvoice', '--aggregate', 'Invoice', '--permission', 'invoice.issue'],
      ['state-machine', 'Invoice', '--value', 'draft', '--value', 'issued', '--transition', 'issue:draft>issued'],
    ];

    for (const step of steps) {
      expect(cli(root, 'generate', step[0] ?? '', 'billing', ...step.slice(1)).code, step.join(' ')).toBe(0);
    }
  };

  it('names the refusal class and its factory under "named"', () => {
    const root = project('around-named');

    generateAround(root);

    expect(read(root, FILES.aggregate)).toContain('`throw <Refusal>.for<Fact>(...)`');
    expect(read(root, FILES.aggregate)).toContain('`ddd-ts-kit generate error billing <Refusal> <factory>`');
    expect(read(root, FILES.entity)).toContain('`ddd-ts-kit generate error billing <Refusal> <factory>`');
    expect(read(root, FILES.value)).toContain('`InvalidMoney.forValue(value)`');
    expect(read(root, FILES.handler)).toContain('`UnknownInvoice.forInvoice(id)`');
    expect(read(root, FILES.machine)).toContain('=> <Refusal>.for<Fact>(...)');

    for (const file of Object.values(FILES)) {
      expect(read(root, file), file).not.toMatch(/InvoiceError|<Concept>/);
    }
  });

  it('adds the refusal to the error class of the concept under "factories", as before', () => {
    const root = project('around-factories', '--refusals', 'factories');

    generateAround(root);

    expect(read(root, FILES.aggregate)).toContain('`throw InvoiceError.<refusal>(...)`');
    expect(read(root, FILES.entity)).toContain('`ddd-ts-kit generate error billing <Concept> <refusal>`');
    expect(read(root, FILES.value)).toContain('`<Concept>Error.invalidMoney(value)`');
    expect(read(root, FILES.handler)).toContain('`InvoiceError.notFound(id)`');
    expect(read(root, FILES.machine)).toContain('=> InvoiceError.<refusal>(...)');
  });
});
