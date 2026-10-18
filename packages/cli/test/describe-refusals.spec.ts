import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { billingProject as project, generateError as generate } from './support/billing-error-project.js';

const CONTEXT_DOC = 'src/contexts/billing/CONTEXT.md';
const ISSUED = 'src/contexts/billing/domain/errors/invoice-already-issued.error.ts';
const VOIDED = 'src/contexts/billing/domain/errors/invoice-voided.error.ts';

const VOIDED_CLASS = `import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { BillingCodes } from '@/contexts/billing/domain/errors/codes';

export class InvoiceVoided extends DomainRefusal {
  readonly code = BillingCodes.InvoiceVoided;

  static forInvoice(invoiceId: string, voidedAt: Date) {
    return InvoiceVoided.refusal('The invoice was voided.', { invoiceId, voidedAt }).exposing('voidedAt', 'invoiceId');
  }

  static atDate(voidedAt: Date) {
    return InvoiceVoided.refusal('An invoice was voided on that date.', { voidedAt });
  }
}
`;

describe('the errors of a context of one class per refusal ("stack.refusals": "named")', () => {
  let root: string;

  beforeAll(() => {
    root = project('describe-named');

    expect(generate(root, 'InvoiceAlreadyIssued', 'forInvoice').code).toBe(0);
    expect(generate(root, 'InvoiceAlreadyIssued', 'atIssue').code).toBe(0);

    expect(
      generate(
        root,
        'InvoiceVoided',
        'forInvoice',
        '--code',
        'INVOICE_CANCELLED',
        '--term',
        'Void=To cancel an invoice',
      ).code,
    ).toBe(0);

    write(root, VOIDED, VOIDED_CLASS);
    expect(cli(root, 'docs').code).toBe(0);
  });

  it('gives describe one row per factory, its code read from the list of the context', () => {
    const described = cli(root, 'describe', 'billing', '--json').json() as { errors: Record<string, unknown>[] };

    expect(described.errors).toEqual([
      {
        errorClass: 'InvoiceAlreadyIssued',
        refusal: 'forInvoice',
        code: 'INVOICE_ALREADY_ISSUED',
        exposes: [],
        file: ISSUED,
        named: true,
      },
      {
        errorClass: 'InvoiceAlreadyIssued',
        refusal: 'atIssue',
        code: 'INVOICE_ALREADY_ISSUED',
        exposes: [],
        file: ISSUED,
        named: true,
      },
      {
        errorClass: 'InvoiceVoided',
        refusal: 'forInvoice',
        code: 'INVOICE_CANCELLED',
        exposes: ['voidedAt', 'invoiceId'],
        file: VOIDED,
        named: true,
      },
      {
        errorClass: 'InvoiceVoided',
        refusal: 'atDate',
        code: 'INVOICE_CANCELLED',
        exposes: [],
        file: VOIDED,
        named: true,
      },
    ]);

    const text = cli(root, 'describe', 'billing').stdout;

    expect(text).not.toContain('errors: none');
    expect(text).toContain('INVOICE_ALREADY_ISSUED (InvoiceAlreadyIssued.forInvoice)');
    expect(text).toContain('INVOICE_CANCELLED (InvoiceVoided.forInvoice, exposes voidedAt, invoiceId)');
  });

  it('writes the same rows in the reference of CONTEXT.md, under columns named after the refusal and its factory', () => {
    const doc = read(root, CONTEXT_DOC);

    expect(doc).toContain('### Errors\n\n| Refusal | Factory | Code | Exposed facts |\n|---|---|---|---|\n');

    expect(doc).toContain('| `InvoiceAlreadyIssued` | `forInvoice` | `INVOICE_ALREADY_ISSUED` | none |');
    expect(doc).toContain('| `InvoiceAlreadyIssued` | `atIssue` | `INVOICE_ALREADY_ISSUED` | none |');
    expect(doc).toContain('| `InvoiceVoided` | `forInvoice` | `INVOICE_CANCELLED` | `voidedAt`, `invoiceId` |');
    expect(doc).toContain('| `InvoiceVoided` | `atDate` | `INVOICE_CANCELLED` | none |');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('gives a class with no factory one row of its own, and none to a class whose code the list does not hold', () => {
    write(
      root,
      'src/contexts/billing/domain/errors/invoice-locked.error.ts',
      "import { DomainRefusal } from '@ddd-ts-kit/kernel';\nimport { BillingCodes } from '@/contexts/billing/domain/errors/codes';\n\nexport class InvoiceLocked extends DomainRefusal {\n  readonly code = BillingCodes.InvoiceLocked;\n}\n",
    );

    const codes = 'src/contexts/billing/domain/errors/codes.ts';

    write(root, codes, read(root, codes).replace("InvoiceVoided: 'INVOICE_CANCELLED',", ''));

    const described = cli(root, 'describe', 'billing', '--json').json() as { errors: Record<string, unknown>[] };

    expect(described.errors.map(({ errorClass, refusal }) => `${String(errorClass)}.${String(refusal)}`)).toEqual([
      'InvoiceAlreadyIssued.forInvoice',
      'InvoiceAlreadyIssued.atIssue',
    ]);

    write(root, codes, read(root, codes).replace('} as const;', "  InvoiceLocked: 'INVOICE_LOCKED',\n} as const;"));

    expect(cli(root, 'describe', 'billing').stdout).toContain('INVOICE_LOCKED (InvoiceLocked)');
    expect(cli(root, 'docs').code).toBe(0);
    expect(read(root, CONTEXT_DOC)).toContain('| `InvoiceLocked` | none | `INVOICE_LOCKED` | none |');
  });

  it('keeps the columns of the error classes while a concept class is left, since they say the truth of every row', () => {
    write(
      root,
      'src/contexts/billing/domain/errors/invoice.error.ts',
      "import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class InvoiceError extends ConceptError {\n  static unpaid(invoiceId: string) {\n    return InvoiceError.refusal('INVOICE_UNPAID', `Invoice ${invoiceId} is unpaid.`, { invoiceId });\n  }\n}\n",
    );

    expect(cli(root, 'docs').code).toBe(0);

    const doc = read(root, CONTEXT_DOC);

    expect(doc).toContain('### Errors\n\n| Error class | Refusal | Code | Exposed facts |\n');
    expect(doc).toContain('| `InvoiceError` | `unpaid` | `INVOICE_UNPAID` | none |');
    expect(doc).toContain('| `InvoiceAlreadyIssued` | `forInvoice` | `INVOICE_ALREADY_ISSUED` | none |');
  });
});
