import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers.js';
import { failure } from './reports.js';

const BILLING = 'src/contexts/billing';
const ERRORS = `${BILLING}/domain/errors`;
const PLAN = 'error-factories.plan.json';
const TERMS = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

const legacy = (name: string, code: string, constructor: string): string =>
  `import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class ${name} extends DomainError {\n  readonly code = '${code}';\n${constructor}}\n`;

const spec = (name: string, file: string, call: string, code: string): string =>
  [
    "import { describe, expect, it } from 'vitest';",
    "import { DomainError } from '@ddd-ts-kit/kernel';",
    `import { ${name} } from '@/contexts/billing/domain/errors/${file}.error';`,
    '',
    `describe('${name}', () => {`,
    "  it('carries its stable code', () => {",
    `    const error = ${call};`,
    '',
    '    expect(error).toBeInstanceOf(DomainError);',
    `    expect(error.code).toBe('${code}');`,
    '  });',
    '});',
    '',
  ].join('\n');

const AGGREGATE = [
  "import { AggregateRoot, err, type Result } from '@ddd-ts-kit/kernel';",
  "import { InvoiceAlreadyIssuedError } from '@/contexts/billing/domain/errors/invoice-already-issued.error';",
  "import { InvoiceNotFoundError } from '@/contexts/billing/domain/errors/invoice-not-found.error';",
  "import type { TooLateError } from '@/contexts/billing/domain/errors/too-late.error';",
  '',
  'export class Invoice extends AggregateRoot {',
  '  issue(at: Date): Result<void, InvoiceAlreadyIssuedError | InvoiceNotFoundError> {',
  "    // new InvoiceAlreadyIssuedError('kept in a comment')",
  '    return err(new InvoiceAlreadyIssuedError(this.id, at));',
  '  }',
  '',
  '  find(): never {',
  '    throw new InvoiceNotFoundError(this.id);',
  '  }',
  '',
  '  late(error: unknown): error is TooLateError {',
  '    return error instanceof InvoiceNotFoundError;',
  '  }',
  '}',
  '',
].join('\n');

interface Plan {
  contexts: Record<string, { class: string; code: string; concept: string; factory: string }[]>;
}

describe('error-factories', () => {
  let root: string;

  beforeAll(() => {
    root = legacyProject();
  });

  it('needs to be told what to do', () => {
    expect(failure(cli(root, 'error-factories', '--json')).message).toBe('error-factories needs --plan or --apply.');
    expect(failure(cli(root, 'error-factories', '--apply', '--json')).message).toContain('holds no plan');
  });

  it('proposes the aggregate a class is named after, and nothing when none is', () => {
    expect(cli(root, 'error-factories', '--plan', '--dry-run').stdout).toContain(`would write   ${PLAN}`);
    expect(exists(root, PLAN)).toBe(false);
    expect(cli(root, 'error-factories', '--plan').code).toBe(0);

    const plan = JSON.parse(read(root, PLAN)) as Plan;

    expect(plan.contexts['billing']?.map((entry) => [entry.class, entry.concept, entry.factory])).toEqual([
      ['InvoiceAlreadyIssuedError', 'Invoice', 'alreadyIssued'],
      ['InvoiceNotFoundError', 'Invoice', 'notFound'],
      ['LedgerClosedError', '', 'ledgerClosed'],
      ['TooLateError', '', 'tooLate'],
    ]);
  });

  it('refuses a plan with an undecided class, and one whose factory does not say the code', () => {
    expect(failure(cli(root, 'error-factories', '--apply', '--json')).message).toContain(
      'LedgerClosedError has no concept',
    );

    const plan = JSON.parse(read(root, PLAN)) as Plan;

    for (const entry of plan.contexts['billing'] ?? []) {
      entry.concept ||= 'Issue';
    }

    write(root, PLAN, JSON.stringify(plan));
    write(root, `${PLAN}.kept`, JSON.stringify(plan));

    for (const entry of (plan.contexts['billing'] ?? []).slice(0, 1)) {
      entry.factory = 'create';
    }

    write(root, PLAN, JSON.stringify(plan));
    expect(failure(cli(root, 'error-factories', '--apply', '--json')).message).toContain('says that an error is built');
    write(root, PLAN, read(root, `${PLAN}.kept`));
  });
});

describe('error-factories --apply', () => {
  let root: string;

  beforeAll(() => {
    root = legacyProject();
    cli(root, 'error-factories', '--plan');

    const plan = JSON.parse(read(root, PLAN)) as Plan;

    for (const entry of plan.contexts['billing'] ?? []) {
      entry.concept ||= 'Issue';
    }

    write(root, PLAN, JSON.stringify(plan));
  });

  it('writes nothing on a dry run', () => {
    expect(cli(root, 'error-factories', '--apply', '--dry-run').stdout).toContain(
      'would move    InvoiceAlreadyIssuedError -> InvoiceError.alreadyIssued',
    );

    expect(exists(root, `${ERRORS}/invoice.error.ts`)).toBe(false);
  });

  it('turns each class into a factory of its concept class, with its parameters, its message and its plain facts', () => {
    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { moved: string[]; manual: string[] };

    expect(applied.moved).toEqual([
      'InvoiceAlreadyIssuedError -> InvoiceError.alreadyIssued',
      'InvoiceNotFoundError -> InvoiceError.notFound',
      'TooLateError -> IssueError.tooLate',
    ]);

    const concept = read(root, `${ERRORS}/invoice.error.ts`);

    expect(concept).toContain(
      'export class InvoiceError extends ConceptError {\n  static alreadyIssued(invoiceId: string, issuedAt: Date) {',
    );

    expect(concept).toContain("'INVOICE_ALREADY_ISSUED',");
    expect(concept).toContain('`Invoice ${invoiceId} was issued at ${issuedAt.toISOString()}.`,');
    expect(concept).toContain('{ invoiceId, issuedAt },');

    expect(concept).toContain(
      "  static notFound(id: string) {\n    return InvoiceError.refusal('INVOICE_NOT_FOUND', `Invoice ${id} does not exist.`, { id });\n  }\n}\n",
    );

    expect(read(root, `${ERRORS}/issue.error.ts`)).toContain(
      "static tooLate(message: string) {\n    return IssueError.refusal('TOO_LATE', message, { message });",
    );

    expect(exists(root, `${ERRORS}/invoice-not-found.error.ts`)).toBe(false);
    expect(applied.manual[0]).toContain('LedgerClosedError is left as it is, it has members of its own');
    expect(exists(root, `${ERRORS}/ledger-closed.error.ts`)).toBe(true);
  });

  it('moves the cases of each spec under the name of its factory', () => {
    const merged = read(root, `${BILLING}/test/unit/invoice.error.spec.ts`);

    expect(exists(root, `${BILLING}/test/unit/invoice-already-issued.error.spec.ts`)).toBe(false);
    expect(merged.match(/^import /gm)).toHaveLength(3);
    expect(merged).toContain("import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';");
    expect(merged).toContain("describe('InvoiceError', () => {\n  describe('alreadyIssued', () => {\n    it('carries");
    expect(merged).toContain("      const error = InvoiceError.alreadyIssued('i-1', new Date(0));");
    expect(merged).toContain("  });\n\n  describe('notFound', () => {");
  });

  it('rewrites every file that named a class, and says the form in the config', () => {
    const aggregate = read(root, `${BILLING}/domain/aggregates/invoice.aggregate.ts`);

    expect(aggregate.match(/^import .*error';$/gm)).toEqual([
      "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
      "import type { IssueError } from '@/contexts/billing/domain/errors/issue.error';",
    ]);

    expect(aggregate).toContain('issue(at: Date): Result<void, InvoiceError> {');
    expect(aggregate).toContain("// new InvoiceAlreadyIssuedError('kept in a comment')");
    expect(aggregate).toContain('return err(InvoiceError.alreadyIssued(this.id, at));');
    expect(aggregate).toContain('throw InvoiceError.notFound(this.id);');
    expect(aggregate).toContain("return InvoiceError.is(error, 'INVOICE_NOT_FOUND');");
    expect(aggregate).toContain('late(error: unknown): error is IssueError {');
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { refusals: 'factories' } });
  });

  it('says which properties of an error became facts', () => {
    const fresh = legacyProject();

    cli(fresh, 'error-factories', '--plan');
    write(fresh, PLAN, read(root, PLAN));

    const applied = cli(fresh, 'error-factories', '--apply', '--json').json() as { manual: string[] };

    expect(applied.manual).toContain(
      'InvoiceAlreadyIssuedError.invoiceId was a property of the error: read `error.facts.invoiceId` where it was read.',
    );
  });

  it('has nothing left to move when run again', () => {
    const again = cli(root, 'error-factories', '--apply', '--json').json() as { moved: string[]; written: string[] };

    expect(again).toMatchObject({ moved: [], written: [], removed: [] });
  });
});

function legacyProject(): string {
  const root = tempDir('error-factories');

  expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...TERMS).code).toBe(0);
  expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);
  write(root, `${BILLING}/domain/aggregates/invoice.aggregate.ts`, AGGREGATE);

  write(
    root,
    `${ERRORS}/invoice-already-issued.error.ts`,
    legacy(
      'InvoiceAlreadyIssuedError',
      'INVOICE_ALREADY_ISSUED',
      '\n  constructor(readonly invoiceId: string, issuedAt: Date) {\n    super(`Invoice ${invoiceId} was issued at ${issuedAt.toISOString()}.`);\n  }\n',
    ),
  );

  write(
    root,
    `${ERRORS}/invoice-not-found.error.ts`,
    legacy(
      'InvoiceNotFoundError',
      'INVOICE_NOT_FOUND',
      '\n  constructor(id: string) {\n    super(`Invoice ${id} does not exist.`);\n  }\n',
    ),
  );

  write(root, `${ERRORS}/too-late.error.ts`, legacy('TooLateError', 'TOO_LATE', ''));

  write(
    root,
    `${ERRORS}/ledger-closed.error.ts`,
    legacy('LedgerClosedError', 'LEDGER_CLOSED', '\n  readonly retryable = false;\n'),
  );

  write(
    root,
    `${BILLING}/test/unit/invoice-already-issued.error.spec.ts`,
    spec(
      'InvoiceAlreadyIssuedError',
      'invoice-already-issued',
      "new InvoiceAlreadyIssuedError('i-1', new Date(0))",
      'INVOICE_ALREADY_ISSUED',
    ),
  );

  write(
    root,
    `${BILLING}/test/unit/invoice-not-found.error.spec.ts`,
    spec('InvoiceNotFoundError', 'invoice-not-found', "new InvoiceNotFoundError('i-1')", 'INVOICE_NOT_FOUND'),
  );

  return root;
}
