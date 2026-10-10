import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { COMMAND, MODULE, QUERY, ROUTE } = PATHS;

export const AUTHZ_DECLARED_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'authz/declared',
    name: 'a permission or a public mark on every registration, a security on every route',
    expect: 'pass',
    files: project({
      [COMMAND]: 'export class IssueInvoiceCommand {}\n',
      [MODULE]: [
        'export function billingModule(builder: Builder): void {',
        '  builder',
        '    .command(IssueInvoiceCommand)',
        "    .requires(billingPermissions['invoice.issue'])",
        '    .handledBy(IssueInvoiceHandler, [Clock]);',
        '  builder.query(InvoicesIssuedQuery).public().handledBy(InvoicesIssuedHandler, []);',
        '}',
        '',
      ].join('\n'),
      [ROUTE]:
        "export const issueInvoiceRoute = defineRoute({ method: 'POST', path: '/invoices', security: ['bearer'] }, issue);\nexport const statusRoute = defineRoute({ method: 'GET', path: '/status', security: false }, status);\n",
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'wired by hand: every command and query is in the authorization map',
    expect: 'pass',
    files: project(
      {
        [COMMAND]: 'export class IssueInvoiceCommand {}\n',
        [QUERY]: 'export class InvoicesIssuedQuery {}\n',
        [MODULE]:
          "export const billingModule = [\n  requires(IssueInvoiceCommand, billingPermissions['invoice.issue']),\n  publicUseCase(InvoicesIssuedQuery),\n];\n",
      },
      { [CONFIG_FILE]: config({ stack: { di: 'manual' } }) },
    ),
  },
  {
    ruleId: 'authz/declared',
    name: 'a command registered without a permission, next to a declared query',
    expect: { file: MODULE },
    files: project({
      [MODULE]:
        'export function billingModule(builder: Builder): void {\n  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [Clock]);\n  builder.query(InvoicesIssuedQuery).public().handledBy(InvoicesIssuedHandler, []);\n}\n',
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'wired by hand: a command missing from the authorization map',
    expect: { file: COMMAND },
    files: project(
      {
        [COMMAND]: 'export class IssueInvoiceCommand {}\n',
        [QUERY]: 'export class InvoicesIssuedQuery {}\n',
        [MODULE]: 'export const billingModule = [publicUseCase(InvoicesIssuedQuery)];\n',
      },
      { [CONFIG_FILE]: config({ stack: { di: 'manual' } }) },
    ),
  },
  {
    ruleId: 'authz/declared',
    name: 'a route that does not declare its security',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: "export const issueInvoiceRoute = defineRoute({ method: 'POST', path: '/invoices' }, issue);\n",
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'declared style: @Requires or @Public on the message class is the declaration, whatever the lines it spans',
    expect: 'pass',
    files: declaredProject({
      [COMMAND]:
        "import { Requires } from '@ddd-ts-kit/kernel/declarations';\n\n@Requires(\n  billingPermissions['invoice.issue'],\n  { audited: ['customerId'] },\n)\nexport class IssueInvoiceCommand {}\n",
      [QUERY]: DECLARED.query,
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'declared style: a command class carrying neither @Requires nor @Public',
    expect: { file: COMMAND },
    files: declaredProject({ [COMMAND]: 'export class IssueInvoiceCommand {}\n', [QUERY]: DECLARED.query }),
  },
  {
    ruleId: 'authz/declared',
    name: 'declared style: a decorator of the same name that does not come from the kernel declarations',
    expect: { file: QUERY },
    files: declaredProject({
      [QUERY]:
        "import { Public } from '@/contexts/billing/application/authorization/home-made.js';\n\n@Public()\nexport class InvoicesIssuedQuery {}\n",
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'explicit style: a module registering a message that declares its own access',
    expect: 'pass',
    files: project({
      [COMMAND]: DECLARED.command,
      [MODULE]:
        "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';\nexport function billingModule(builder: Builder): void {\n  builder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [Clock]);\n}\n",
    }),
  },
  {
    ruleId: 'authz/declared',
    name: 'wired by hand: a decorated command needs no entry in the authorization map',
    expect: 'pass',
    files: project(
      { [COMMAND]: DECLARED.command, [MODULE]: 'export const billingModule = [];\n' },
      { [CONFIG_FILE]: config({ stack: { di: 'manual' } }) },
    ),
  },
];
