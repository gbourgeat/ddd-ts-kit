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
import { source } from './source.js';
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
  PLATFORM_MODULE,
  POLICY,
  PORT,
} = PATHS;

const { SPEC } = SAMPLES;

/** A class of infrastructure/ that implements a port, in a file without a role suffix, declared by nothing. */
const STRIPE = `${BILLING}/infrastructure/external/stripe-payment-gateway.ts`;

const STRIPE_IMPORT =
  "import { StripePaymentGateway } from '@/contexts/billing/infrastructure/external/stripe-payment-gateway.js';";

const PORT_IMPORT = "import { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port.js';";

const stripeGateway = (...before: string[]): string =>
  source(PORT_IMPORT, '', ...before, 'export class StripePaymentGateway implements PaymentGateway {}');

const explicitModule = (...statements: string[]): string =>
  source("import type { ModuleBuilder } from '@ddd-ts-kit/di';", PORT_IMPORT, ...statements);

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
    name: 'a domain event handler attached under the name its event class declares',
    expect: 'pass',
    files: declaredProject({
      [EVENT]: DECLARED.event,
      [EVENT_HANDLER]: DECLARED.eventHandler,
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
        "export * from '@/contexts/billing/application/authorization/only-issuer-voids.policy.js';\n",
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
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'declared style: every adapter carries its declaration in its role file',
    expect: 'pass',
    files: declaredProject(DECLARED_CONTEXT),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'explicit style: an adapter bound to its port in the module file',
    expect: 'pass',
    files: project({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(),
      [MODULE]: explicitModule(
        STRIPE_IMPORT,
        '',
        'export function billingModule(builder: ModuleBuilder): void {',
        '  builder.bind(PaymentGateway).toClass(StripePaymentGateway, []);',
        '}',
      ),
    }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'declared style: an adapter without a declaration, bound by the platform',
    expect: 'pass',
    files: declaredProject({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(),
      [PLATFORM_MODULE]: source(
        "import { defineModule } from '@ddd-ts-kit/di';",
        PORT_IMPORT,
        STRIPE_IMPORT,
        '',
        "export const platformModule = defineModule('platform', (builder) => {",
        '  builder.bind(PaymentGateway).toFactory(() => new StripePaymentGateway());',
        '});',
      ),
    }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'an adapter kept unwired on purpose, with a suppression that points to a decision record',
    expect: 'pass',
    files: declaredProject({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(
        '// ddd-ts-kit-disable-next-line declarations/port-adapter-wired -- ADR-0001: kept for the switch back to Stripe',
      ),
    }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'explicit style: an adapter the generator wrote, its outside system not ready, left to do',
    expect: 'pass',
    files: project({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(
        '// TODO(platform): replace the body by the real client of the outside system, built in billing.module.ts.',
      ),
    }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'declared style: an adapter that carries no declaration and that nothing binds',
    expect: { file: STRIPE },
    files: declaredProject({ [PORT]: DECLARED.port, [STRIPE]: stripeGateway() }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'explicit style: an adapter the module file does not bind',
    expect: { file: STRIPE },
    files: project({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(),
      [MODULE]: explicitModule(
        '',
        'export function billingModule(builder: ModuleBuilder): void {',
        '  builder.bind(PaymentGateway).toValue(null);',
        '}',
      ),
    }),
  },
  {
    ruleId: 'declarations/port-adapter-wired',
    name: 'explicit style: an adapter only a test binds',
    expect: { file: STRIPE },
    files: project({
      [PORT]: DECLARED.port,
      [STRIPE]: stripeGateway(),
      [`${BILLING}/test/integration/stripe-payment-gateway.spec.ts`]: source(
        "import { it } from 'vitest';",
        STRIPE_IMPORT,
        '',
        "it.todo('charges through Stripe', () => new StripePaymentGateway());",
      ),
    }),
  },
];
