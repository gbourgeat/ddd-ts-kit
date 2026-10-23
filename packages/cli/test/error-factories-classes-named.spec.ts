import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const ERRORS = `${BILLING}/domain/errors`;
const PLAN = 'error-factories.plan.json';

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const legacy = (name: string, code: string, ...body: string[]): string =>
  lines(
    "import { DomainError } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${name} extends DomainError {`,
    `  readonly code = '${code}';`,
    ...body,
    '}',
  );

const AGGREGATE = lines(
  "import { AggregateRoot, err, type Result } from '@ddd-ts-kit/kernel';",
  "import { InvoiceAlreadyIssuedError } from '@/contexts/billing/domain/errors/invoice-already-issued.error';",
  "import type { TooLateError } from '@/contexts/billing/domain/errors/too-late.error';",
  '',
  'export class Invoice extends AggregateRoot {',
  '  issue(at: Date): Result<void, InvoiceAlreadyIssuedError> {',
  '    return err(new InvoiceAlreadyIssuedError(this.id, at));',
  '  }',
  '',
  '  late(error: unknown): error is TooLateError {',
  '    return error instanceof InvoiceAlreadyIssuedError;',
  '  }',
  '}',
);

const SPEC = lines(
  "import { describe, expect, it } from 'vitest';",
  "import { InvoiceAlreadyIssuedError } from '@/contexts/billing/domain/errors/invoice-already-issued.error';",
  '',
  "describe('InvoiceAlreadyIssuedError', () => {",
  "  it('carries its stable code', () => {",
  "    const error = new InvoiceAlreadyIssuedError('i-1', new Date(0));",
  '',
  '    expect(error).toBeInstanceOf(InvoiceAlreadyIssuedError);',
  "    expect(error.code).toBe('INVOICE_ALREADY_ISSUED');",
  '  });',
  '});',
);

const HANDLER_SPEC = lines(
  "import { it } from 'vitest';",
  "import { TooLateError } from '@/contexts/billing/domain/errors/too-late.error';",
  '',
  "it('refuses a late issue', () => {",
  '  given(invoice).when(issue).thenError(TooLateError);',
  '});',
);

/**
 * The classes per error of the fixture: one whose first parameter is its concept, one whose first
 * parameter is another subject, one without constructor, one with members of its own.
 */
function writeErrors(root: string): void {
  write(
    root,
    `${ERRORS}/invoice-already-issued.error.ts`,
    legacy(
      'InvoiceAlreadyIssuedError',
      'INVOICE_ALREADY_ISSUED',
      '',
      '  constructor(readonly invoiceId: string, issuedAt: Date) {',
      '    super(`Invoice ${invoiceId} was issued at ${issuedAt.toISOString()}.`);',
      '  }',
    ),
  );

  write(
    root,
    `${ERRORS}/invoice-too-large.error.ts`,
    legacy(
      'InvoiceTooLargeError',
      'INVOICE_TOO_LARGE',
      '',
      '  constructor(customerId: string, amount: number) {',
      '    super(`Customer ${customerId} cannot be billed ${amount}.`);',
      '  }',
    ),
  );

  write(root, `${ERRORS}/too-late.error.ts`, legacy('TooLateError', 'TOO_LATE'));

  write(
    root,
    `${ERRORS}/ledger-closed.error.ts`,
    legacy('LedgerClosedError', 'LEDGER_CLOSED', '  readonly retryable = false;'),
  );
}

describe('error-factories, from one class per error to the named form', () => {
  let root: string;
  let applied: { moved: string[]; removed: string[]; manual: string[] };

  beforeAll(() => {
    root = tempDir('error-factories-classes-named');
    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment');
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice');
    write(root, `${BILLING}/domain/aggregates/invoice.aggregate.ts`, AGGREGATE);

    writeErrors(root);
    write(root, `${BILLING}/test/unit/invoice-already-issued.error.spec.ts`, SPEC);
    write(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`, HANDLER_SPEC);
    expect(cli(root, 'error-factories', '--plan').code).toBe(0);
    applied = cli(root, 'error-factories', '--apply', '--json').json() as typeof applied;
  });

  it('proposes a class named after the code and a factory for its first parameter, its concept, or its message', () => {
    const plan = JSON.parse(read(root, PLAN)) as {
      contexts: Record<string, { from: string; class: string; factory: string }[]>;
    };

    expect(plan.contexts['billing']?.map((entry) => [entry.from, entry.class, entry.factory])).toEqual([
      ['InvoiceAlreadyIssuedError', 'InvoiceAlreadyIssued', 'forInvoice'],
      ['InvoiceTooLargeError', 'InvoiceTooLarge', 'forCustomer'],
      ['LedgerClosedError', 'LedgerClosed', 'withMessage'],
      ['TooLateError', 'TooLate', 'withMessage'],
    ]);

    expect(applied.moved).toEqual([
      'InvoiceAlreadyIssuedError -> InvoiceAlreadyIssued.forInvoice',
      'InvoiceTooLargeError -> InvoiceTooLarge.forCustomer',
      'TooLateError -> TooLate.withMessage',
    ]);
  });

  it('writes the class in place of the class per error, its constructor become its factory, its code listed', () => {
    expect(read(root, `${ERRORS}/invoice-already-issued.error.ts`)).toBe(
      lines(
        "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
        "import { BillingCodes } from '@/contexts/billing/billing.codes';",
        '',
        'export class InvoiceAlreadyIssued extends DomainRefusal {',
        '  readonly code = BillingCodes.InvoiceAlreadyIssued;',
        '',
        '  static forInvoice(invoiceId: string, issuedAt: Date) {',
        '    return InvoiceAlreadyIssued.refusal(`Invoice ${invoiceId} was issued at ${issuedAt.toISOString()}.`, {',
        '      invoiceId,',
        '      issuedAt,',
        '    });',
        '  }',
        '}',
      ),
    );

    expect(read(root, `${BILLING}/billing.codes.ts`)).toContain(
      "export const BillingCodes = {\n  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  InvoiceTooLarge: 'INVOICE_TOO_LARGE',\n  TooLate: 'TOO_LATE',\n} as const;\n",
    );

    expect(read(root, `${ERRORS}/too-late.error.ts`)).toContain(
      '  static withMessage(message: string) {\n    return TooLate.refusal(message, { message });\n  }\n',
    );
  });

  it('keeps the spec of the class in its place, under the name of the class', () => {
    const spec = read(root, `${BILLING}/test/unit/invoice-already-issued.error.spec.ts`);

    expect(spec).toContain(
      "import { InvoiceAlreadyIssued } from '@/contexts/billing/domain/errors/invoice-already-issued.error';",
    );

    expect(spec).toContain("describe('InvoiceAlreadyIssued', () => {");
    expect(spec).toContain("const error = InvoiceAlreadyIssued.forInvoice('i-1', new Date(0));");
    expect(spec).toContain('expect(error).toBeInstanceOf(InvoiceAlreadyIssued);');
    expect(applied.removed).toEqual([]);
  });

  it('renames the class wherever it stands, as a type or as a value, and builds it through its factory', () => {
    const aggregate = read(root, `${BILLING}/domain/aggregates/invoice.aggregate.ts`);

    expect(aggregate).toContain("import type { TooLate } from '@/contexts/billing/domain/errors/too-late.error';");
    expect(aggregate).toContain('issue(at: Date): Result<void, InvoiceAlreadyIssued> {');
    expect(aggregate).toContain('return err(InvoiceAlreadyIssued.forInvoice(this.id, at));');
    expect(aggregate).toContain('return error instanceof InvoiceAlreadyIssued;');
    expect(read(root, `${BILLING}/test/unit/issue-invoice.handler.spec.ts`)).toContain('.thenError(TooLate);');
  });

  it('leaves the class it cannot move, and says the facts its properties became', () => {
    expect(exists(root, `${ERRORS}/ledger-closed.error.ts`)).toBe(true);

    expect(applied.manual).toContain(
      `${ERRORS}/ledger-closed.error.ts: LedgerClosedError is left as it is, it has members of its own: write the factory by hand and decide where they go.`,
    );

    expect(applied.manual).toContain(
      'InvoiceAlreadyIssuedError.invoiceId was a property of the error: read `error.facts.invoiceId` where it was read.',
    );

    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { refusals: 'named' } });
  });
});
