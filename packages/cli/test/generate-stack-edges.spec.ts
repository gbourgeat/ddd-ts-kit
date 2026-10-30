import { describe, expect, it } from 'vitest';
import { cli, read, walk, write, type CliResult } from './helpers';
import { failure, report } from './reports';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const LEDGER = `${BILLING}/domain/aggregates/ledger.aggregate.ts`;
const TERMS = ['--term', 'Invoice=A request for payment', '--term', 'Cancel=To void an invoice'];

/** A project of the stack the flags name, with a billing context that cancels invoices. */
function billing(...flags: string[]): string {
  const root = initProject(...flags);

  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...TERMS).code).toBe(0);
  expect(cli(root, 'generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel').code).toBe(0);

  return root;
}

/** The report of a command that must succeed; its error output is the message of a failure. */
function ok(root: string, ...args: string[]): ReturnType<typeof report> {
  const result: CliResult = cli(root, 'generate', ...args, '--json');

  expect(result.code, result.stderr || result.stdout).toBe(0);

  return report(result);
}

const CANCEL_ROUTE = ['route', 'billing', 'CancelInvoice', '--method', 'DELETE', '--path', '/invoices/:invoiceId'];

/** A command of twelve fields, whose required list the formatter would not keep on one line. */
const NOTIFY = `import { Command } from '@ddd-ts-kit/kernel';

export class NotifyCustomerCommand extends Command<void> {
  constructor(
${Array.from({ length: 12 }, (_, index) => `    readonly customerContactChannel${String(index)}: string,`).join('\n')}
  ) {
    super();
  }
}
`;

describe('generate, on a stack other than the default one', () => {
  it('refuses a route without an HTTP stack', () => {
    const root = billing('--http', 'none');

    expect(failure(cli(root, 'generate', ...CANCEL_ROUTE, '--json')).message).toBe(
      'This project has no HTTP stack (stack.http is "none").',
    );
  });

  it('refuses a cache policy where the routes are functions', () => {
    const root = billing('--routes', 'functions');

    expect(failure(cli(root, 'generate', ...CANCEL_ROUTE, '--cache', 'public', '--json')).message).toBe(
      '--cache writes the cache policy of a controller, and this project writes its routes as functions.',
    );
  });

  it('says how to turn representations and forms on when they are off', () => {
    const root = billing('--representations', 'json', '--forms', 'off');

    ok(root, 'aggregate', 'billing', 'Invoice', '--term', 'Issue=To make an invoice final');

    ok(
      root,
      'command',
      'billing',
      'IssueInvoice',
      '--creates',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
    );

    ok(root, 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');

    expect(ok(root, 'representation', 'billing', 'IssueInvoice', 'csv').notes.join('\n')).toContain(
      'The route answers JSON only until "stack.representations" is "negotiated"',
    );

    expect(ok(root, 'form', 'billing', 'IssueInvoice').notes.join('\n')).toContain(
      'The form is served once "stack.forms" is "on"',
    );
  });

  it('tells where a simulated adapter goes when its port is already bound in the module file', () => {
    const root = billing('--style', 'explicit');

    ok(root, 'port', 'billing', 'PaymentGateway');
    ok(root, 'adapter', 'billing', 'PaymentGateway');

    expect(ok(root, 'adapter', 'billing', 'PaymentGateway', '--kind', 'simulated').notes).toContain(
      "PaymentGateway is already bound in billing.module.ts: bind SimulatedPaymentGateway in its place, with .as('external').",
    );
  });

  it('refuses personal columns that name none', () => {
    const root = billing('--privacy', 'on');

    ok(root, 'aggregate', 'billing', 'Invoice');

    expect(
      failure(cli(root, 'generate', 'repository', 'billing', 'Invoice', '--personal', ',', '--json')).message,
    ).toBe('--personal names no column.');
  });

  it('writes a standard schema with no params, and a required list on several lines when it does not fit on one', () => {
    const root = billing('--validation', 'standard-schema');
    const folder = `${BILLING}/presentation/http/notifications/notify-customer`;

    ok(
      root,
      'command',
      'billing',
      'NotifyCustomer',
      '--public',
      '--term',
      'Notify=To tell',
      '--term',
      'Customer=Who pays',
    );

    write(root, `${BILLING}/application/commands/notify-customer/notify-customer.command.ts`, NOTIFY);
    ok(root, 'route', 'billing', 'NotifyCustomer', '--method', 'POST', '--path', '/notifications');

    const written = walk(root, folder)
      .map((file) => read(root, file))
      .join('\n');

    expect(written).toContain("  required: [\n    'customerContactChannel0',\n");
    expect(written).not.toContain('NotifyCustomerParams');
  });

  it('writes no builder of an event-sourced aggregate whose create records no birth, and leaves to the team one whose union of events it cannot find', () => {
    const root = billing('--event-sourcing', 'on');
    const terms = ['--term', 'Ledger=The payments of a customer', '--term', 'Create=To open'];

    ok(root, 'aggregate', 'billing', 'Ledger', '--event-sourced', ...terms);
    write(root, LEDGER, read(root, LEDGER).replace('.record(new ', '.remember(new '));

    expect(ok(root, 'builder', 'billing', 'Ledger', '--force').notes.join('\n')).toContain(
      '`create` of the event-sourced Ledger records no birth event: no builder written.',
    );

    write(root, LEDGER, read(root, LEDGER).replace('export type LedgerEvent =', 'export type LedgerEvents ='));

    expect(
      ok(root, 'domain-event', 'billing', 'Ledger', 'Credited', '--term', 'Credit=To add money').notes.join('\n'),
    ).toContain('Ledger is event-sourced: add LedgerCredited to the union of its events');
  });
});
