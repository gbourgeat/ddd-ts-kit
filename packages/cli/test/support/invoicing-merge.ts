import type { Histories } from './merge-repository';

/** Files of a billing context: the branch adds paying an invoice, the trunk cancelling one, in the same places. */
export const INVOICE = 'src/contexts/billing/invoice.ts';
export const ROUTES = 'src/contexts/billing/routes.ts';
export const SPEC = 'src/contexts/billing/invoice.spec.ts';
export const SLICES = 'docs/architecture/slices.md';

export const PAY = [
  '  pay(amount: Money, at: Date): void {',
  "    if (this.status !== 'issued') throw InvoiceError.notIssued(this.id);",
  "    this.status = 'paid';",
  '  }',
];

export const CANCEL = ['  cancel(reason: CancelReason): void {', "    this.status = 'cancelled';", '  }'];

export function invoice(...methods: ReadonlyArray<readonly string[]>): string {
  const issue = ['  issue(at: Date): void {', "    this.status = 'issued';", '  }'];

  return [
    'export class Invoice {',
    "  private status = 'draft';",
    ...[issue, ...methods].flatMap((method) => ['', ...method]),
    '}',
    '',
  ].join('\n');
}

export function routes(...names: readonly string[]): string {
  return [
    'export const routes = [',
    '  // ddd-ts-kit:routes',
    '  issueInvoiceRoute,',
    ...names.map((name) => `  ${name},`),
    '  // /ddd-ts-kit:routes',
    '];',
    '',
  ].join('\n');
}

export function spec(...tests: ReadonlyArray<readonly [string, string]>): string {
  const all: ReadonlyArray<readonly [string, string]> = [['issues a draft invoice', 'issue'], ...tests];

  return [
    "describe('Invoice', () => {",
    ...all.flatMap(([title, call], index) => [
      ...(index === 0 ? [] : ['']),
      `  it('${title}', () => {`,
      `    expect(${call}()).toBeDefined();`,
      '  });',
    ]),
    '});',
    '',
  ].join('\n');
}

export function slices(pay: string, cancel: string): string {
  return [
    '| # | context | kind | slice | start with | depends on | owner | status |',
    '|---|---|---|---|---|---|---|---|',
    '| US1.01 | billing | slice | Issue invoice | generate command | | billing | done |',
    `| US1.02 | billing | slice | Pay invoice | generate command | US1.01 | billing | ${pay} |`,
    `| US1.03 | billing | slice | Cancel invoice | generate command | US1.01 | billing | ${cancel} |`,
    '',
  ].join('\n');
}

/** The branch delivers row US1.02 (pay), the trunk row US1.03 (cancel), each in the aggregate, the routes, the spec and the slices file. */
export const PAY_AND_CANCEL: Histories = {
  base: { [INVOICE]: invoice(), [ROUTES]: routes(), [SPEC]: spec(), [SLICES]: slices('todo', 'todo') },
  ours: {
    [INVOICE]: invoice(PAY),
    [ROUTES]: routes('payInvoiceRoute'),
    [SPEC]: spec(['pays an issued invoice', 'pay']),
    [SLICES]: slices('done', 'todo'),
  },
  theirs: {
    [INVOICE]: invoice(CANCEL),
    [ROUTES]: routes('cancelInvoiceRoute'),
    [SPEC]: spec(['cancels an invoice with its reason', 'cancel']),
    [SLICES]: slices('todo', 'done'),
  },
};

/** What a merge that keeps both sides writes. */
export const BOTH_KEPT = {
  [INVOICE]: invoice(PAY, CANCEL),
  [ROUTES]: routes('payInvoiceRoute', 'cancelInvoiceRoute'),
  [SPEC]: spec(['pays an issued invoice', 'pay'], ['cancels an invoice with its reason', 'cancel']),
  [SLICES]: slices('done', 'done'),
};
