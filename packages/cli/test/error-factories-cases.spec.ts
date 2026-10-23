import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const ERRORS = `${BILLING}/domain/errors`;
const PLAN = 'error-factories.plan.json';

interface Entry {
  class: string;
  concept: string;
}

interface Plan {
  to: string;
  contexts: Record<string, Entry[]>;
}

const lines = (...all: string[]): string => `${all.join('\n')}\n`;

const legacy = (name: string, code: string): string =>
  lines(
    "import { DomainError } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${name} extends DomainError {`,
    `  readonly code = '${code}';`,
    '',
    '  constructor(invoiceId: string) {',
    '    super(`Invoice ${invoiceId} is refused.`);',
    '  }',
    '}',
  );

describe('error-factories --apply to factories, the classes per error a plan does not move', () => {
  let root: string;
  let plan: Plan;

  beforeAll(() => {
    root = tempDir('error-factories-cases');
    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);

    expect(
      cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment')
        .code,
    ).toBe(0);

    write(root, `${ERRORS}/invoice-not-found.error.ts`, legacy('InvoiceNotFoundError', 'INVOICE_NOT_FOUND'));
    expect(cli(root, 'error-factories', '--plan', '--to', 'factories').code).toBe(0);
    plan = JSON.parse(read(root, PLAN)) as Plan;
  });

  const applied = (contexts: Record<string, Entry[]>): { moved: string[] } => {
    write(root, PLAN, JSON.stringify({ ...plan, contexts }));

    return cli(root, 'error-factories', '--apply', '--json').json() as { moved: string[] };
  };

  it('leaves a class of a context the plan does not list', () => {
    expect(applied({ shipping: [] }).moved).toEqual([]);
    expect(exists(root, `${ERRORS}/invoice-not-found.error.ts`)).toBe(true);
  });

  it('leaves a class the plan gives itself as concept: it is already the class of its concept', () => {
    const entries = (plan.contexts['billing'] ?? []).map((entry) => ({ ...entry, concept: 'InvoiceNotFound' }));

    expect(applied({ billing: entries }).moved).toEqual([]);
    expect(exists(root, `${ERRORS}/invoice-not-found.error.ts`)).toBe(true);
    expect(exists(root, `${ERRORS}/invoice.error.ts`)).toBe(false);
  });

  it('names the class of the concept where its spec named the class per error as a value', () => {
    write(
      root,
      `${BILLING}/test/unit/invoice-not-found.error.spec.ts`,
      lines(
        "import { describe, expect, it } from 'vitest';",
        "import { InvoiceNotFoundError } from '@/contexts/billing/domain/errors/invoice-not-found.error';",
        '',
        "describe('InvoiceNotFoundError', () => {",
        "  it('is built by its class', () => {",
        "    expect(new InvoiceNotFoundError('i-1').constructor).toBe(InvoiceNotFoundError);",
        '  });',
        '});',
      ),
    );

    const entries = (plan.contexts['billing'] ?? []).map((entry) => ({ ...entry, concept: 'Invoice' }));

    expect(applied({ billing: entries }).moved).toEqual(['InvoiceNotFoundError -> InvoiceError.invoiceNotFound']);

    expect(read(root, `${BILLING}/test/unit/invoice.error.spec.ts`)).toContain(
      "      expect(InvoiceError.invoiceNotFound('i-1').constructor).toBe(InvoiceError);",
    );
  });
});
