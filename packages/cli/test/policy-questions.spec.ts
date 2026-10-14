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
  it('writes a generated command again asking the policy, and the checker accepts it', () => {
    const project = billing();

    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);
    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');

    const handler = read(project, HANDLER);

    expect(handler).toContain('  constructor(private readonly access: Access) {}');
    expect(handler).toContain(MARKER);

    expect(handler).toContain(
      "    await this.access.authorize(command.actor, billingPermissions['invoice.cancel'], command);",
    );

    expect(read(project, `${BILLING}/billing.declarations.ts`)).toContain('injected(CancelInvoiceHandler, [Access]);');
    expect(cli(project, 'check', '--rule', 'authz/policy-asked').code).toBe(0);
  });

  it('leaves only a marker in a handler the team already changed', () => {
    const project = billing();

    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);

    write(
      project,
      HANDLER,
      read(project, HANDLER).replace('// TODO(domain): receive the repository', '// receive the repository'),
    );

    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');

    const handler = read(project, HANDLER);

    expect(handler).toContain(`${MARKER}: load the element this command acts on, then ask it before the change`);
    expect(handler).not.toContain('\n    await this.access.authorize(');
    expect(cli(project, 'check', '--rule', 'authz/policy-asked').code).toBe(0);
  });

  it('generates a command asking the policy of its permission when the policy exists already', () => {
    const project = billing();

    generate(project, 'entity', 'billing', 'InvoiceLine', ...TERMS, '--term', 'Line=One billed item of an invoice');
    generate(project, 'policy', 'billing', 'OnlyIssuerCancels', '--permission', 'invoice.cancel');
    generate(project, 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel', ...TERMS);

    expect(read(project, HANDLER)).toContain(
      "    await this.access.authorize(command.actor, billingPermissions['invoice.cancel'], command);",
    );
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
