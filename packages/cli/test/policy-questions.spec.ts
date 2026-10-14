import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';

const BILLING = 'src/contexts/billing';
const HANDLER = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const MARKER = "// TODO(domain): a policy refines billingPermissions['invoice.cancel']";

const TERMS = [
  '--term',
  'Invoice=A request for payment sent to a customer',
  '--term',
  'Cancel=To void an invoice before payment',
];

function billing(): string {
  const project = tempDir('policy-questions');

  expect(cli(project, 'init', '--context', 'billing:core').code).toBe(0);

  return project;
}

function generate(project: string, ...args: string[]): void {
  const result = cli(project, 'generate', ...args);

  expect(result.code, result.stderr).toBe(0);
}

describe('a policy and the use cases of its permission', () => {
  it('marks the handler of an existing use case where it asks the policy, and the checker accepts it', () => {
    const project = billing();

    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);
    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');

    expect(read(project, HANDLER)).toContain(
      `  async execute(command: CancelInvoiceCommand): Promise<void> {\n    ${MARKER}: load the element this command acts on, then ask it before the change, \`await this.access.authorize(command.actor, billingPermissions['invoice.cancel'], <element>)\``,
    );

    expect(cli(project, 'check', '--rule', 'authz/policy-asked').code).toBe(0);
  });

  it('marks the handler of a use case generated after the policy of its permission', () => {
    const project = billing();

    generate(project, 'entity', 'billing', 'InvoiceLine', ...TERMS, '--term', 'Line=One billed item of an invoice');
    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');
    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);

    expect(read(project, HANDLER)).toContain(MARKER);
  });

  it('leaves alone a handler that already asks, and reports one that stopped asking', () => {
    const project = billing();

    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);

    const asking = read(project, HANDLER).replace(
      '  async execute(command: CancelInvoiceCommand): Promise<void> {\n',
      "  async execute(command: CancelInvoiceCommand): Promise<void> {\n    await this.access.authorize(command.actor, billingPermissions['invoice.cancel'], command);\n",
    );

    write(project, HANDLER, asking);
    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');

    expect(read(project, HANDLER)).not.toContain(MARKER);

    write(project, HANDLER, asking.replace(/^ {4}await this\.access\.authorize.*\n/m, ''));

    expect(cli(project, 'check', '--rule', 'authz/policy-asked').code).toBe(1);
  });
});
