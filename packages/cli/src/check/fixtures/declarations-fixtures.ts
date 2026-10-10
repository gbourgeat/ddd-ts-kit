import { aggregate } from './aggregate.js';
import { DECLARED } from './declared.js';
import { DECLARED_BARREL } from './declared-barrel.js';
import { DECLARED_CONTEXT } from './declared-context.js';
import { declaredProject } from './declared-project.js';
import { discoveredProject } from './discovered-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';
import { withoutFile } from './without-file.js';

const {
  ADAPTER,
  AGGREGATE,
  BARREL,
  BILLING,
  COMMAND,
  EVENT,
  EVENT_HANDLER,
  EVENT_HANDLER_SPEC,
  HANDLER,
  INTEGRATION_HANDLER,
  INTEGRATION_HANDLER_SPEC,
  JOB,
  JOB_SPEC,
  MODULE,
  POLICY,
} = PATHS;

const { SPEC } = SAMPLES;

export const DECLARATIONS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'declarations/role-declared',
    name: 'every role file exports a class carrying the decorator of its role, with written names',
    expect: 'pass',
    files: declaredProject(DECLARED_CONTEXT),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'explicit style: role files without a decorator, wired by the module file',
    expect: 'pass',
    files: project({
      ...handler('export class IssueInvoiceHandler {}\n'),
      [POLICY]: 'export class OnlyIssuerVoidsPolicy {}\n',
      [ADAPTER]: 'export class InMemoryInvoiceRepository {}\n',
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a handler file whose class declares nothing',
    expect: { file: HANDLER },
    files: declaredProject({ [COMMAND]: DECLARED.command, ...handler('export class IssueInvoiceHandler {}\n') }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a command handler declared as a query handler',
    expect: { file: HANDLER },
    files: declaredProject({
      [COMMAND]: DECLARED.command,
      ...handler(
        "import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@QueryHandler(IssueInvoiceCommand, [])\nexport class IssueInvoiceHandler {}\n",
      ),
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a policy named by a variable',
    expect: { file: POLICY },
    files: declaredProject({
      [POLICY]:
        "import { Policy } from '@ddd-ts-kit/kernel/declarations';\n\n@Policy(billingPermissions['invoice.void'], { name: POLICY_NAME })\nexport class OnlyIssuerVoidsPolicy {}\n",
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a domain event handler named by a template with a substitution',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({
      [EVENT_HANDLER]:
        "import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@DomainEventHandler(InvoiceIssued, { name: `${CONTEXT}.invoice.issued` })\nexport class InvoiceIssuedEventHandler {}\n",
      [EVENT_HANDLER_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'an integration event handler whose consumer name is a variable',
    expect: { file: INTEGRATION_HANDLER },
    also: ['events/consumer-idempotent'],
    files: declaredProject({
      [INTEGRATION_HANDLER]:
        "import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';\n\n@IntegrationEventHandler(productListedV1, options, [])\nexport class ProductListedIntegrationHandler {}\n",
      [INTEGRATION_HANDLER_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a domain event handler written under another name than the one its event carries',
    expect: { file: EVENT_HANDLER },
    files: declaredProject({
      [EVENT]: DECLARED.event,
      [EVENT_HANDLER]: DECLARED.eventHandler.replace('billing.invoice.issued', 'billing.invoice.sent'),
      [EVENT_HANDLER_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a declaration decorator on a class of the domain',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: declaredProject(
      aggregate(
        "import { Policy } from '@ddd-ts-kit/kernel/declarations';\n\n@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })\nexport class Invoice {}\n",
      ),
    ),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a declared class in a file that is not a role file',
    expect: { file: `${BILLING}/infrastructure/persistence/in-memory-invoices.reader.ts` },
    files: declaredProject({
      [`${BILLING}/infrastructure/persistence/in-memory-invoices.reader.ts`]:
        "import { Adapter } from '@ddd-ts-kit/kernel/declarations';\n\n@Adapter(InvoicesReader)\nexport class InMemoryInvoicesReader implements InvoicesReader {}\n",
    }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'a barrel listing the role files of its context, one export per file, sorted by path',
    expect: 'pass',
    files: declaredProject(DECLARED_CONTEXT, { [BARREL]: DECLARED_BARREL }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'assembly by discovery: no barrel to keep',
    expect: 'pass',
    files: discoveredProject(DECLARED_CONTEXT),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'explicit style: no barrel is expected',
    expect: 'pass',
    files: project({
      ...handler('export class IssueInvoiceHandler {}\n'),
      [MODULE]: 'export const billingModule = {};\n',
    }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'a declared context without its barrel',
    expect: { file: BARREL },
    files: withoutFile(declaredProject(DECLARED_CONTEXT), BARREL),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'a role file added by hand that the barrel does not list',
    expect: { file: BARREL },
    files: declaredProject(DECLARED_CONTEXT, {
      [BARREL]: DECLARED_BARREL.replace(
        "export * from './application/authorization/only-issuer-voids.policy.js';\n",
        '',
      ),
    }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'assembly by discovery: a barrel left behind',
    expect: { file: BARREL },
    files: discoveredProject(DECLARED_CONTEXT, { [BARREL]: DECLARED_BARREL }),
  },
  {
    ruleId: 'declarations/role-declared',
    name: 'a job file whose class carries no @Scheduled',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: DECLARED.job.replace("@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])\n", ''),
      [JOB_SPEC]: SPEC,
    }),
  },
];
