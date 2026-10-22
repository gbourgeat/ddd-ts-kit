import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

const VALIDATIONS = ['zod', 'class-validator', 'typebox'] as const;
const HTTP = 'src/contexts/billing/presentation/http';
const INVOICES = `${HTTP}/invoices/search-invoices/search-invoices.controller.ts`;
const CREDIT_NOTES = `${HTTP}/credit-notes/search-credit-notes/search-credit-notes.controller.ts`;

/** Two searches of one context, written by the generator and not filled yet: their lines are both `{ id }`. */
function twoSearches(validation: string): string {
  const root = initProject('--validation', validation, '--context', 'billing:core');

  generate(root, 'query', 'SearchInvoices', '--search', '--permission', 'invoice.search');
  generate(root, 'route', 'SearchInvoices', '--method', 'GET', '--path', '/invoices');
  generate(root, 'query', 'SearchCreditNotes', '--search', '--permission', 'credit-note.search');
  generate(root, 'route', 'SearchCreditNotes', '--method', 'GET', '--path', '/credit-notes');

  return root;
}

function generate(root: string, kind: string, name: string, ...flags: readonly string[]): void {
  const extra = kind === 'route' ? [] : ['--allow-name'];
  const result = cli(root, 'generate', kind, 'billing', name, ...flags, ...extra);

  expect(result.code, result.stderr).toBe(0);
}

function duplicates(root: string): readonly { readonly file: string }[] {
  return checkJsonOf(cli(root, 'check', '--rule', 'schema/no-duplicate-shape', '--json')).violations;
}

describe('the shapes a new project generates', () => {
  it.each(VALIDATIONS)('are no copy of each other with %s, two searches and two commands later', (validation) => {
    const root = twoSearches(validation);

    generate(root, 'command', 'IssueInvoice', '--permission', 'invoice.issue');
    generate(root, 'route', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
    generate(root, 'command', 'VoidInvoice', '--permission', 'invoice.void');
    generate(root, 'route', 'VoidInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/void');

    expect(duplicates(root)).toEqual([]);
  });

  it('are a copy once the developer fills two lines with the same fields', () => {
    const root = twoSearches('zod');

    for (const file of [INVOICES, CREDIT_NOTES]) {
      write(
        root,
        file,
        read(root, file).replace(/\/\/ TODO\(domain\): declare the fields[^\n]*/, 'total: z.number(),'),
      );
    }

    expect(duplicates(root)).toMatchObject([{ file: INVOICES }]);
  });
});
