import { describe, expect, it } from 'vitest';
import { cli, exists } from './helpers';
import { initProject } from './support/init-project';

describe('the glossary refusal of a use case and its permission', () => {
  function orderProject(): string {
    const root = initProject('--context', 'ordering:core', '--audit', 'off');

    expect(cli(root, 'generate', 'aggregate', 'ordering', 'Order', '--term', 'Order=A purchase').code).toBe(0);

    return root;
  }

  it.each(['query', 'command'])('lists the missing words of the %s and of its permission in one message', (kind) => {
    const root = orderProject();

    const refused = cli(root, 'generate', kind, 'ordering', 'GetOrder', '--permission', 'order.read');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"GetOrder" uses "get" and the permission "order.read" uses "read"');
    expect(refused.stderr).toContain('--term "Get=<what it means for the business>"');
    expect(refused.stderr).toContain('--term "Read=<what it means for the business>"');
  });

  it('lists a technical word of the permission with the missing terms of the use case', () => {
    const root = orderProject();

    const refused = cli(root, 'generate', 'query', 'ordering', 'GetOrder', '--permission', 'order.manager');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('the permission "order.manager" carries the technical word "manager"');
  });

  it('is satisfied by the two terms of one command', () => {
    const root = orderProject();

    const done = cli(
      root,
      'generate',
      'query',
      'ordering',
      'GetOrder',
      '--permission',
      'order.read',
      '--term',
      'Get=to read',
      '--term',
      'Read=to look',
    );

    expect(done.code).toBe(0);
    expect(exists(root, 'src/contexts/ordering/ordering.permissions.ts')).toBe(true);
  });
});

describe('a query named List...', () => {
  it('is refused before the glossary, with the Search form', () => {
    const root = initProject('--context', 'billing:core', '--audit', 'off');

    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A bill').code).toBe(0);

    const refused = cli(root, 'generate', 'query', 'billing', 'ListInvoices', '--permission', 'invoice.read');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('names a query List...');
    expect(refused.stderr).toContain('Name it SearchInvoices');
    expect(exists(root, 'src/contexts/billing/application/queries/list-invoices')).toBe(false);
  });
});
