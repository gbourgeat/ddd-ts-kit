import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const ERRORS = `${BILLING}/invoices/domain/errors`;
const TERMS = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

const AGGREGATE = [
  "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
  "import { InvoiceNotFoundError } from '@/contexts/billing/invoices/domain/errors/invoice-not-found.error';",
  '',
  'export class Invoice extends AggregateRoot {',
  '  find(): never {',
  '    throw new InvoiceNotFoundError(this.id);',
  '  }',
  '}',
  '',
].join('\n');

describe('error-factories, on errors kept in a module of the model', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('error-factories-modules');

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...TERMS).code).toBe(0);
    expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', 'The invoices.').code).toBe(0);
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--module', 'invoices').code).toBe(0);
    write(root, `${BILLING}/invoices/domain/aggregates/invoice.aggregate.ts`, AGGREGATE);

    write(
      root,
      `${ERRORS}/invoice-not-found.error.ts`,
      "import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class InvoiceNotFoundError extends DomainError {\n  readonly code = 'INVOICE_NOT_FOUND';\n\n  constructor(id: string) {\n    super(`Invoice ${id} does not exist.`);\n  }\n}\n",
    );
  }, 120_000);

  it('reads the errors of the module, and writes the class of their concept next to them', () => {
    expect(cli(root, 'error-factories', '--plan', '--to', 'factories').code).toBe(0);
    expect(read(root, 'error-factories.plan.json')).toContain('InvoiceNotFoundError');

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { moved: string[] };

    expect(applied.moved).toEqual(['InvoiceNotFoundError -> InvoiceError.notFound']);
    expect(exists(root, `${ERRORS}/invoice.error.ts`)).toBe(true);
    expect(exists(root, `${ERRORS}/invoice-not-found.error.ts`)).toBe(false);
    expect(exists(root, `${BILLING}/domain/errors/invoice.error.ts`)).toBe(false);

    expect(read(root, `${BILLING}/invoices/domain/aggregates/invoice.aggregate.ts`)).toContain(
      "import { InvoiceError } from '@/contexts/billing/invoices/domain/errors/invoice.error';",
    );
  });
});

describe('error-factories, on errors of one concept read from two folders', () => {
  it('writes nothing, and says to gather them first', () => {
    const root = tempDir('error-factories-scattered');

    const legacy = (name: string, code: string): string =>
      `import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class ${name} extends DomainError {\n  readonly code = '${code}';\n\n  constructor(id: string) {\n    super(\`Invoice ${'$'}{id}.\`);\n  }\n}\n`;

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...TERMS).code).toBe(0);
    expect(cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', 'The invoices.').code).toBe(0);
    // The aggregate the plan names the concept of both errors after.
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--module', 'invoices').code).toBe(0);
    write(root, `${ERRORS}/invoice-not-found.error.ts`, legacy('InvoiceNotFoundError', 'INVOICE_NOT_FOUND'));
    write(root, `${BILLING}/domain/errors/invoice-paid.error.ts`, legacy('InvoicePaidError', 'INVOICE_PAID'));

    expect(cli(root, 'error-factories', '--plan', '--to', 'factories').code).toBe(0);

    const refused = cli(root, 'error-factories', '--apply');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Nothing was written');
    expect(refused.stderr).toContain('move-to-module');
    expect(exists(root, `${ERRORS}/invoice-not-found.error.ts`)).toBe(true);
    expect(exists(root, `${BILLING}/domain/errors/invoice-paid.error.ts`)).toBe(true);
    expect(exists(root, `${ERRORS}/invoice.error.ts`)).toBe(false);
  }, 120_000);
});
