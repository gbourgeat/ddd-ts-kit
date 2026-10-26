import { describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers';

const COMMANDS = 'src/contexts/billing/application/commands';
const QUERIES = 'src/contexts/billing/application/queries';

describe('relationships: the resource of a use case', () => {
  it('leaves a marker naming the element when the resource is the context', () => {
    const root = project('rebac');

    const command = read(root, `${COMMANDS}/cancel-invoice/cancel-invoice.command.ts`);

    expect(command).toContain("resource: () => ({ type: 'context', id: 'billing' })");

    expect(command).toContain(
      "// TODO(domain): name the invoice this command is about, `{ type: 'invoice', id: command.invoiceId }`",
    );

    expect(command).toContain("derive 'invoice.cancel' on that type in the relationship schema");

    expect(read(root, `${QUERIES}/find-invoice/find-invoice.query.ts`)).toContain(
      "// TODO(domain): name the invoice this query is about, `{ type: 'invoice', id: query.invoiceId }`",
    );
  });

  it('leaves no marker under another model, nor for a public use case', () => {
    const root = project('rbac');

    expect(read(root, `${COMMANDS}/cancel-invoice/cancel-invoice.command.ts`)).not.toContain('name the invoice');
  });

  it('keeps the context for a search, which the scope narrows', () => {
    const root = project('rebac');

    expect(read(root, `${QUERIES}/search-invoices/search-invoices.query.ts`)).not.toContain('name the invoice');
  });
});

function project(authz: string): string {
  const root = tempDir('rebac-resource');

  expect(cli(root, 'init', '--authz', authz).code).toBe(0);

  expect(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Cancel=To void an invoice',
      '--term',
      'Find=To read one',
      '--term',
      'Search=To list',
    ).code,
  ).toBe(0);

  expect(cli(root, 'generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel').code).toBe(0);
  expect(cli(root, 'generate', 'query', 'billing', 'FindInvoice', '--permission', 'invoice.find').code).toBe(0);

  expect(
    cli(root, 'generate', 'query', 'billing', 'SearchInvoices', '--permission', 'invoice.search', '--search').code,
  ).toBe(0);

  return root;
}
