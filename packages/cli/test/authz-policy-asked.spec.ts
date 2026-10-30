import { describe, expect, it } from 'vitest';
import { PATHS } from '../src/check/fixtures/paths';
import { project } from '../src/check/fixtures/project';
import { tempDir, write } from './helpers';
import { reported } from './rules-support';

const { BILLING, COMMAND, HANDLER, MODULE, POLICY, QUERY, QUERY_HANDLER } = PATHS;
const MAP = `${BILLING}/application/authorization/billing.requirements.ts`;
const ISSUE = "billingPermissions['invoice.issue']";
const LIST = 'billingPermissions.list';

const SAVING_HANDLER =
  'export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.invoices.save(command);\n  }\n}\n';

const READING_HANDLER =
  'export class InvoicesIssuedHandler {\n  async execute(query: InvoicesIssuedQuery): Promise<string[]> {\n    return this.reader.read(query);\n  }\n}\n';

function definedPolicy(permission: string): string {
  return `export const onlyAccountants = definePolicy({\n  name: 'only-accountants',\n  permission: ${permission},\n  allows: () => true,\n});\n`;
}

function policyAskedIn(files: Readonly<Record<string, string>>): { file: string; message: string }[] {
  const root = tempDir('authz-policy-asked');

  for (const [file, content] of Object.entries(project(files))) {
    write(root, file, content);
  }

  return reported(root, 'authz/policy-asked').map(({ file, message }) => ({ file, message }));
}

describe('authz/policy-asked beyond the decorated use cases', () => {
  it('reads a requirement from the authorization map of a context, and asks a query handler about its query', () => {
    const found = policyAskedIn({
      [MAP]: `export const requirements = [\n  requires(InvoicesIssuedQuery, ${LIST}),\n  requires('IssueInvoice', ${ISSUE}),\n];\n`,
      [POLICY]: definedPolicy(LIST),
      [QUERY]: 'export class InvoicesIssuedQuery {}\n',
      [QUERY_HANDLER]: READING_HANDLER,
    });

    expect(found).toEqual([
      {
        file: QUERY_HANDLER,
        message: `A policy refines ${LIST}, which InvoicesIssuedQuery requires, and InvoicesIssuedHandler never asks it: the bus checked the permission without the element, and the rule of the policy is skipped.`,
      },
    ]);
  });

  it('reads no refined permission from a policy defined without one, from options passed whole, or from another decorator', () => {
    const found = policyAskedIn({
      [MODULE]: `export function billingModule(builder: Builder): void {\n  builder.command(IssueInvoiceCommand).requires(${ISSUE}).handledBy(IssueInvoiceHandler);\n}\n`,
      [POLICY]: [
        "import { Adapter } from '@ddd-ts-kit/kernel/declarations';",
        '',
        "export const loose = definePolicy({ name: 'loose', allows: () => true });",
        'export const passed = definePolicy(options);',
        '',
        `@Adapter(${ISSUE})`,
        'export class NotAPolicy {}',
        '',
      ].join('\n'),
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [HANDLER]: SAVING_HANDLER,
    });

    expect(found).toEqual([]);
  });

  it('reads nothing from a registration that declares no requirement', () => {
    const found = policyAskedIn({
      [MODULE]:
        'export function billingModule(builder: Builder): void {\n  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler);\n}\n',
      [POLICY]: definedPolicy(ISSUE),
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [HANDLER]: SAVING_HANDLER,
    });

    expect(found).toEqual([]);
  });

  it('skips a permission written as no entry of a permission set, and a use case it cannot find', () => {
    const found = policyAskedIn({
      [MODULE]: [
        'export function billingModule(builder: Builder): void {',
        "  builder.command(IssueInvoiceCommand).requires(permissionOf('invoice.issue')).handledBy(IssueInvoiceHandler);",
        `  builder.command(VoidInvoiceCommand).requires(${ISSUE}).handledBy(VoidInvoiceHandler);`,
        '}',
        '',
      ].join('\n'),
      [POLICY]: definedPolicy(ISSUE),
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [HANDLER]: SAVING_HANDLER,
    });

    expect(found).toEqual([]);
  });
});

describe('authz/policy-asked on a decision the handler drops', () => {
  const askingWith = (body: string): Readonly<Record<string, string>> => ({
    [MAP]: `export const requirements = [requires(IssueInvoiceCommand, ${ISSUE})];\n`,
    [POLICY]: definedPolicy(ISSUE),
    [COMMAND]: 'export class IssueInvoiceCommand {}\n',
    [HANDLER]: `export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<unknown> {\n${body}\n  }\n}\n`,
  });

  it('reports a decision on the permission that is a statement of its own, behind await, void or nothing', () => {
    const dropped = [
      `    await this.access.decide(command.actor, ${ISSUE}, command);`,
      `    void this.access.decideOn({ actor: command.actor, permission: ${ISSUE}, subject: command });`,
      `    if (command) {\n      this.access.decide(command.actor, ${ISSUE}, command)\n    }`,
    ];

    for (const body of dropped) {
      expect(policyAskedIn(askingWith(body)).map(({ message }) => message)).toEqual([
        `IssueInvoiceHandler asks Access about ${ISSUE}, which IssueInvoiceCommand requires and a policy refines, and drops the decision: a denied one does not stop the change.`,
      ]);
    }
  });

  it('reads a decision kept, returned or read on the spot, and one on another permission, as no drop', () => {
    const kept = [
      `    const decision = await this.access.decide(command.actor, ${ISSUE}, command);\n    return decision.allowed;`,
      `    return await this.access.decide(command.actor, ${ISSUE}, command);`,
      `    return (await this.access.decide(command.actor, ${ISSUE}, command)).allowed;`,
      `    await this.access.authorize(command.actor, ${ISSUE}, command);\n    await this.access.decide(command.actor, billingPermissions['invoice.read'], command);`,
    ];

    for (const body of kept) {
      expect(policyAskedIn(askingWith(body))).toEqual([]);
    }
  });
});
