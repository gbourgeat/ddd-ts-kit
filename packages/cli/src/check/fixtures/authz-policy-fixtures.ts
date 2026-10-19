import type { Fixture } from './fixture.js';
import type { FixtureFiles } from './fixture-files.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { signatureProject } from './signature-project.js';
import { source } from './source.js';

const { BARREL, COMMAND, HANDLER, MODULE, POLICY } = PATHS;

/** The barrel the generator derives once the handler takes `Access` and the repository in its constructor. */
const BARREL_OF_THE_POLICY = source(
  "import { injected } from '@ddd-ts-kit/kernel/declarations';",
  "import { IssueInvoiceHandler } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js';",
  "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
  "import { Access } from '@ddd-ts-kit/auth';",
  '',
  "export * from '@/contexts/billing/application/authorization/only-issuer-voids.policy.js';",
  "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
  "export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js';",
  '',
  'injected(IssueInvoiceHandler, [Access, InvoiceRepository]);',
);

const ISSUE_POLICY = [
  "import { Policy } from '@ddd-ts-kit/kernel/declarations';",
  '',
  "@Policy(billingPermissions['invoice.issue'], { name: 'billing.only-issuer-voids' })",
  'export class OnlyIssuerVoidsPolicy {}',
  '',
].join('\n');

const EXPLICIT_MODULE = [
  'export function billingModule(builder: Builder): void {',
  "  builder.command(IssueInvoiceCommand).requires(billingPermissions['invoice.issue']).handledBy(IssueInvoiceHandler, [Access]);",
  '}',
  '',
].join('\n');

const DEFINED_POLICY =
  "export const onlyAccountantIssues = definePolicy<unknown>({\n  name: 'only-accountant-issues',\n  permission: billingPermissions['invoice.issue'],\n  allows: (actor) => isAuthenticated(actor),\n});\n";

export const AUTHZ_POLICY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'authz/policy-asked',
    name: 'a policy of the permission, asked by the handler once it holds the element',
    expect: 'pass',
    files: withPolicy(
      declaredHandler("    await this.access.authorize(command.actor, billingPermissions['invoice.issue'], command);"),
    ),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'a policy of the permission the handler never asks',
    expect: { file: HANDLER },
    files: withPolicy(declaredHandler('    await this.invoices.save(command);')),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'a handler still carrying the TODO(domain) the generator left where the policy is asked',
    expect: 'pass',
    files: withPolicy(
      declaredHandler(
        "    // TODO(domain): a policy refines billingPermissions['invoice.issue']: load the element this command acts on, then ask it.\n    await this.invoices.save(command);",
      ),
    ),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'a handler carrying a TODO(review) that names the permission',
    expect: 'pass',
    files: withPolicy(
      declaredHandler(
        "    // TODO(review): ask billingPermissions['invoice.issue'] once the invoice is loaded, not before.\n    await this.invoices.save(command);",
      ),
    ),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'a handler carrying a TODO of another owner that names the permission',
    expect: { file: HANDLER },
    files: withPolicy(
      declaredHandler(
        "    // TODO(billing-team): ask billingPermissions['invoice.issue'] here.\n    await this.invoices.save(command);",
      ),
    ),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'a handler naming the permission in a comment only',
    expect: { file: HANDLER },
    files: withPolicy(
      declaredHandler(
        "    // billingPermissions['invoice.issue'] is decided by the bus\n    await this.access.authorize(command.actor, billingPermissions['invoice.void'], command);",
      ),
    ),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'wired by hand: a policy defined as a value, asked by the handler',
    expect: 'pass',
    files: project({
      [MODULE]: EXPLICIT_MODULE,
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [POLICY]: DEFINED_POLICY,
      ...handler(
        "export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.access.decide(command.actor, billingPermissions['invoice.issue'], command);\n  }\n}\n",
      ),
    }),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'wired by hand: a policy defined as a value the handler never asks',
    expect: { file: HANDLER },
    files: project({
      [MODULE]: EXPLICIT_MODULE,
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [POLICY]: DEFINED_POLICY,
      ...handler(
        'export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.invoices.save(command);\n  }\n}\n',
      ),
    }),
  },
  {
    ruleId: 'authz/policy-asked',
    name: 'wired by hand: a policy defined from options written elsewhere, an object naming the permission after it',
    expect: 'pass',
    files: project({
      [MODULE]: EXPLICIT_MODULE,
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [POLICY]:
        "export const passed = definePolicy(options);\nexport const settings = { permission: billingPermissions['invoice.issue'] };\n",
      ...handler(
        'export class IssueInvoiceHandler {\n  async execute(command: IssueInvoiceCommand): Promise<void> {\n    await this.invoices.save(command);\n  }\n}\n',
      ),
    }),
  },
];

/** The declared issue-invoice handler, given the body of `execute`. */
function declaredHandler(body: string): string {
  return [
    "import type { Access } from '@ddd-ts-kit/auth';",
    "import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';",
    "import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
    "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
    '',
    '@CommandHandler(IssueInvoiceCommand)',
    'export class IssueInvoiceHandler {',
    '  constructor(',
    '    private readonly access: Access,',
    '    private readonly invoices: InvoiceRepository,',
    '  ) {}',
    '',
    '  async execute(command: IssueInvoiceCommand): Promise<void> {',
    body,
    '  }',
    '}',
    '',
  ].join('\n');
}

/** The declared issue-invoice use case whose permission a policy refines, its handler written with `body`. */
function withPolicy(body: string): FixtureFiles {
  return signatureProject(body, { [POLICY]: ISSUE_POLICY, [BARREL]: BARREL_OF_THE_POLICY });
}
