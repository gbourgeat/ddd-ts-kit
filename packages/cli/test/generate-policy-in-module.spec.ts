import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const QUERIES = 'src/contexts/billing/invoicing/application/queries';
const HANDLER = 'src/contexts/billing/invoicing/application/commands/pay-invoice/pay-invoice.handler.ts';

/** A context with a module that holds an invoice, and a command that requires `invoice.pay`. */
function invoicing(): string {
  const root = initProject('--context', 'billing:core', '--audit', 'off');

  const steps = [
    ['generate', 'module', 'billing', 'invoicing', '--term', 'Invoicing=part', '--purpose', 'p'],
    [
      'generate',
      'aggregate',
      'billing',
      'Invoice',
      '--term',
      'Invoice=a bill',
      '--term',
      'Pay=settle',
      '--term',
      'Owner=holder',
      '--module',
      'invoicing',
    ],
    ['generate', 'repository', 'billing', 'Invoice', '--module', 'invoicing'],
  ];

  for (const step of steps) {
    const done = cli(root, ...step);

    expect(done.code, done.stderr).toBe(0);
  }

  return root;
}

const COMMAND = [
  'generate',
  'command',
  'billing',
  'PayInvoice',
  '--permission',
  'invoice.pay',
  '--grant',
  'admin',
  '--aggregate',
  'Invoice',
  '--module',
  'invoicing',
];

const POLICY = [
  'generate',
  'policy',
  'billing',
  'InvoiceOwner',
  '--permission',
  'invoice.pay',
  '--module',
  'invoicing',
];

describe('a policy that refines the permission of a use case of a module', () => {
  it('is asked by the handler when the policy comes after the command', () => {
    const root = invoicing();

    expect(cli(root, ...COMMAND).code).toBe(0);
    expect(cli(root, ...POLICY).code).toBe(0);
    expect(read(root, HANDLER)).toContain('access.authorize');
  });

  it('is asked by the handler when the policy comes before the command', () => {
    const root = invoicing();

    expect(cli(root, ...POLICY).code).toBe(0);
    expect(cli(root, ...COMMAND).code).toBe(0);
    expect(read(root, HANDLER)).toContain('access.authorize');
  });

  it('is asked by a plain query of the module, and leaves a search to its access scope', () => {
    const root = invoicing();

    expect(cli(root, ...POLICY).code).toBe(0);

    const query = cli(
      root,
      'generate',
      'query',
      'billing',
      'GetInvoice',
      '--permission',
      'invoice.pay',
      '--term',
      'Get=read',
      '--module',
      'invoicing',
    );

    const search = cli(
      root,
      'generate',
      'query',
      'billing',
      'SearchInvoices',
      '--permission',
      'invoice.pay',
      '--search',
      '--term',
      'Search=find',
      '--module',
      'invoicing',
    );

    expect(query.code, query.stderr).toBe(0);
    expect(search.code, search.stderr).toBe(0);
    expect(read(root, `${QUERIES}/get-invoice/get-invoice.handler.ts`)).toContain('access.authorize');
    expect(read(root, `${QUERIES}/search-invoices/search-invoices.handler.ts`)).toContain('access.scope');
  });
});

describe('a use case of the same name in two modules', () => {
  it('is refused by the placement, so one logical path never stands for two files', () => {
    const root = invoicing();

    expect(cli(root, 'generate', 'module', 'billing', 'refunds', '--term', 'Refunds=back', '--purpose', 'p').code).toBe(
      0,
    );

    expect(cli(root, ...COMMAND).code).toBe(0);

    const second = cli(root, ...COMMAND.slice(0, -1), 'refunds');

    expect(second.code).toBe(2);
    expect(second.stderr).toContain('would split it between two modules');
  });
});
