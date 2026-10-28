import { describe, expect, it } from 'vitest';
import { bin, findingsOf } from './e2e/run-in';
import { type CliResult, cli, read } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const HANDLER = (name: string): string => `src/contexts/billing/application/commands/${name}/${name}.handler.ts`;
const COMMAND = (name: string): string => `src/contexts/billing/application/commands/${name}/${name}.command.ts`;

function billing(...init: readonly string[]): string {
  const root = initProject(...init);

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
      '--term',
      'Void=Cancel an issued invoice',
      '--term',
      'Issue=Send to the customer',
    ),
  );

  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));

  return root;
}

describe('generate command --aggregate, birth or change', () => {
  it('writes a handler that changes an existing aggregate and writes nothing, unless --creates says it is a birth', () => {
    const root = billing('--di', 'manual');

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
      ),
    );

    const handler = read(root, HANDLER('void-invoice'));

    expect(handler).not.toContain('Invoice.create(');
    expect(handler).not.toContain('.save(');
    expect(handler).not.toContain('IdGenerator');
    expect(handler).toContain('TODO(domain)');
    expect(handler).toContain('Promise<void>');
    expect(handler).toContain('private readonly invoiceRepository: InvoiceRepository');
    expect(read(root, COMMAND('void-invoice'))).toContain('AuthorizedCommand<void>');
    expect(read(root, 'src/contexts/billing/billing.module.ts')).toContain('new VoidInvoiceHandler(invoiceRepository');

    expect(read(root, 'src/contexts/billing/billing.module.ts')).not.toContain(
      'new VoidInvoiceHandler(invoiceRepository, ',
    );
  });

  it('writes the birth, with its identifier answered, when --creates is given', () => {
    const root = billing('--di', 'manual');

    expectOk(
      cli(
        root,
        'generate',
        'command',
        'billing',
        'IssueInvoice',
        '--aggregate',
        'Invoice',
        '--creates',
        '--permission',
        'invoice.issue',
      ),
    );

    const handler = read(root, HANDLER('issue-invoice'));

    expect(handler).toContain('Invoice.create(this.ids.next(), this.clock.now())');
    expect(handler).toContain('decide what "issue invoice" does to an Invoice:');
    expect(handler).toContain('Promise<string>');
    expect(read(root, COMMAND('issue-invoice'))).toContain('AuthorizedCommand<string>');
  });
});

describe('generate command --creates and the policy of a change', () => {
  it('refuses --creates without an aggregate to give birth to', () => {
    const root = billing('--di', 'manual');

    const refused = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--creates',
      '--permission',
      'invoice.issue',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--creates');
    expect(refused.stderr).toContain('--aggregate');
  });

  it('declares the change handler with the repository alone on a tsyringe project', () => {
    const root = billing();

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
      ),
    );

    expect(read(root, HANDLER('void-invoice'))).not.toContain('Invoice.create(');
  });

  it('is still found as a change when a policy of its permission asks to be consulted', () => {
    const root = billing('--di', 'manual');

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
      ),
    );

    expectOk(cli(root, 'generate', 'policy', 'billing', 'OnlyIssuerVoids', '--permission', 'invoice.void'));

    const handler = read(root, HANDLER('void-invoice'));

    expect(handler).toContain(
      "await this.access.authorize(command.actor, billingPermissions['invoice.void'], command);",
    );

    expect(handler).not.toContain('IdGenerator');
  });
});

/** What the formatter of the project would change in it: empty when the generator already wrote it its way. */
const unformatted = (root: string): string =>
  findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=20', '.'] });

describe('the handler of every kind of command is written as the formatter of the project lays it out', () => {
  it.each([
    ['declared', []],
    ['explicit', ['--di', 'manual']],
  ] as const)('%s: a birth, a change, a change a policy refines, a command on no aggregate', (_style, init) => {
    const root = billing(...init);

    const command = (...args: readonly string[]): CliResult =>
      expectOk(cli(root, 'generate', 'command', 'billing', ...args));

    command('IssueInvoice', '--aggregate', 'Invoice', '--creates', '--permission', 'invoice.issue');
    command('VoidInvoice', '--aggregate', 'Invoice', '--permission', 'invoice.void');

    command(
      'ReissueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.reissue',
      '--term',
      'Reissue=Issue again',
    );

    expectOk(cli(root, 'generate', 'policy', 'billing', 'OnlyIssuerReissues', '--permission', 'invoice.reissue'));
    command('IssueInvoices', '--permission', 'invoice.batch', '--term', 'Batch=Several at once');

    expect(read(root, HANDLER('void-invoice'))).toContain(
      '  constructor(private readonly invoiceRepository: InvoiceRepository) {}\n',
    );

    expect(unformatted(root)).toBe('');
  });
});
