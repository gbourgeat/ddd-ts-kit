import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const MODULE = 'src/contexts/billing/billing.module.ts';
const CREATED = 'const invoiceRepository = platform.adapter(';

const IMPORTED =
  "import { KnexInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/knex-invoice.repository';";

/** A context wired by hand, with its Invoice aggregate and its repository. */
function billingByHand(): string {
  const root = initProject('--di', 'manual', '--orm', 'knex');

  expectOk(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--purpose',
      'Bills customers.',
      '--term',
      'Invoice=A request for payment',
    ),
  );

  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));
  expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice'));

  return root;
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe('a repository of a context wired by hand', () => {
  it('is not created in the module file before a use case needs it, and the checker has nothing to say', () => {
    const root = billingByHand();
    const module = read(root, MODULE);

    expect(module).not.toContain('KnexInvoiceRepository');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('is created with the first command on its aggregate, imported once, and found there by the next one', () => {
    const root = billingByHand();

    expectOk(
      cli(
        root,
        'generate',
        'command',
        'billing',
        'IssueInvoice',
        '--aggregate',
        'Invoice',
        '--permission',
        'invoice.issue',
        '--term',
        'Issue=Send to the customer',
      ),
    );

    const first = read(root, MODULE);

    expect(occurrences(first, CREATED)).toBe(1);
    expect(occurrences(first, IMPORTED)).toBe(1);
    expect(first.indexOf(CREATED)).toBeLessThan(first.indexOf('new IssueInvoiceHandler(invoiceRepository'));

    expectOk(
      cli(
        root,
        'generate',
        'command',
        'billing',
        'VoidInvoice',
        '--aggregate',
        'Invoice',
        '--permission',
        'invoice.void',
        '--term',
        'Void=Cancel an issued invoice',
      ),
    );

    const second = read(root, MODULE);

    expect(occurrences(second, CREATED)).toBe(1);
    expect(occurrences(second, IMPORTED)).toBe(1);
    expect(second).toContain('new VoidInvoiceHandler(invoiceRepository');
  });
});
