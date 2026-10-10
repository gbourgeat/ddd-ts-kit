import { declarationsRoleDeclared } from '../../src/rules/declarations-role-declared.js';
import { inProject } from '../support/declared-project.js';
import {
  DECLARED,
  EXPLICIT,
  DECLARATIONS,
  declaring,
  MODULE,
  COMMAND,
  HANDLER,
  QUERY_HANDLER,
  INTEGRATION_HANDLER,
  EVENT_HANDLER,
  PUBLISHER,
  POLICY,
  PERMISSIONS,
  PORT,
  JOB,
  REPOSITORY,
  GATEWAY,
  ADAPTER,
  MAPPER,
  AGGREGATE,
  SPEC,
} from '../support/declared-style.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const ISSUED =
  "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler { async handle(event: InvoiceIssued): Promise<void> {} }";

const ISSUED_EVENT = "import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';";

ruleTester.run('declarations-role-declared', declarationsRoleDeclared, {
  valid: [
    at(
      HANDLER,
      declaring(
        'Clock, CommandHandler',
        '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])\nexport class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {}',
      ),
      DECLARED,
    ),
    at(
      QUERY_HANDLER,
      declaring(
        'QueryHandler',
        '@QueryHandler(SearchInvoicesQuery, [InvoiceReader])\nclass SearchInvoicesHandler {}\nexport { SearchInvoicesHandler };',
      ),
      DECLARED,
    ),
    at(
      INTEGRATION_HANDLER,
      declaring(
        'IntegrationEventHandler',
        "@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [CommandBus])\nexport class CatalogProductListedHandler {}",
      ),
      DECLARED,
    ),
    at(EVENT_HANDLER, declaring('DomainEventHandler', ISSUED), DECLARED),
    at(
      PUBLISHER,
      declaring(
        'DomainEventHandler as Reacts',
        "@Reacts(InvoiceIssued, { name: 'billing.invoice.issued' }, [IntegrationEventPublisher, IdGenerator])\nexport class InvoiceIssuedPublisher {}",
      ),
      DECLARED,
    ),
    at(
      POLICY,
      declaring(
        'Policy',
        "@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })\nexport class OnlyIssuerVoidsPolicy {}",
      ),
      DECLARED,
    ),
    at(
      REPOSITORY,
      declaring(
        'Repository',
        '@Repository(InvoiceRepository, [Database])\nexport class KnexInvoiceRepository implements InvoiceRepository {}',
      ),
      DECLARED,
    ),
    at(
      GATEWAY,
      `import * as declarations from '${DECLARATIONS}';\n@declarations.Gateway(PriceCatalog, [PriceCatalogUpstream])\nexport class InProcessPriceCatalogGateway {}`,
      DECLARED,
    ),
    at(
      ADAPTER,
      declaring(
        'Adapter',
        "import { Retry } from '@ddd-ts-kit/aspects/decorators';\n@Adapter(PaymentProvider, { kind: 'external' })\n@Retry({ attempts: 3 })\nexport class RemotePaymentProvider {}\nclass Helper {}",
      ),
      DECLARED,
    ),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', DECLARED),
    at(COMMAND, declaring('CommandHandler', '@CommandHandler(X, [])\nexport class IssueInvoiceCommand {}'), DECLARED),
    at(PERMISSIONS, 'export const billingPermissions = definePermissions({});', DECLARED),
    at(
      JOB,
      declaring(
        'Scheduled',
        "@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])\nexport class SendRemindersJob implements ScheduledJob {}",
      ),
      DECLARED,
    ),
    at(JOB, 'export class SendRemindersJob implements ScheduledJob {}', EXPLICIT),
    at(
      `${BILLING}/application/commands/issue-invoice/issue-invoice.result.ts`,
      'export interface IssueInvoiceResult { readonly invoiceId: string }',
      DECLARED,
    ),
    at(
      PORT,
      'export abstract class PaymentGateway {\n  abstract charge(invoiceId: string): Promise<void>;\n}',
      DECLARED,
    ),
    at(MAPPER, 'export class InvoiceMapper {}', DECLARED),
    at(
      `${BILLING}/application/commands/issue-invoice/issue-invoice.integration-handler.ts`,
      'export class Misplaced {}',
      DECLARED,
    ),
    at(
      `${BILLING}/application/queries/search-invoices/search-invoices.event-handler.ts`,
      'export class Misplaced {}',
      DECLARED,
    ),
    at(
      `${BILLING}/application/integration/consumers/catalog-product-listed.consumer.ts`,
      'export class FormerName {}',
      DECLARED,
    ),
    at(`${BILLING}/domain/repositories/invoice.repository.ts`, 'export interface InvoiceRepository {}', DECLARED),
    at(AGGREGATE, "import { Repository } from './home-made.js';\n@Repository(X)\nexport class Invoice {}", DECLARED),
    at(SPEC, declaring('CommandHandler', '@CommandHandler(X, [])\nclass Probe {}'), DECLARED),
    at(
      `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.spec.ts`,
      'export class Probe {}',
      DECLARED,
    ),
    at(MODULE, declaring('Policy', '@Policy(permission, { name: NAME })\nclass Inline {}'), EXPLICIT),
    at(HANDLER, 'export class IssueInvoiceHandler {}', EXPLICIT),
    at(HANDLER, 'export class IssueInvoiceHandler {}'),
    at(AGGREGATE, declaring('Repository', '@Repository(X)\nexport class Invoice {}'), EXPLICIT),
    at(
      EVENT_HANDLER,
      declaring(
        'DomainEventHandler',
        "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.paid' })\nexport class InvoiceIssuedEventHandler {}",
      ),
      EXPLICIT,
    ),
    at(HANDLER, 'export class IssueInvoiceHandler {}', { ...DECLARED, rules: { 'declarations/role-declared': 'off' } }),
    at(
      HANDLER,
      '// ddd-ts-kit-disable-next-line declarations/role-declared -- ADR-0012: registered by the legacy module until the migration ends\nexport class IssueInvoiceHandler {}',
      DECLARED,
    ),
    at(
      EVENT_HANDLER,
      declaring('DomainEventHandler', `class InvoiceIssued { readonly name = 'billing.invoice.issued'; }\n${ISSUED}`),
      DECLARED,
    ),
    at(
      EVENT_HANDLER,
      declaring(
        'DomainEventHandler',
        `class InvoiceIssued { static readonly type = 'x'; get name(): string { return compute(); } }\n${ISSUED}`,
      ),
      DECLARED,
    ),
    inProject(EVENT_HANDLER, declaring('DomainEventHandler', `${ISSUED_EVENT}\n${ISSUED}`)),
    inProject(
      EVENT_HANDLER,
      declaring(
        'DomainEventHandler',
        `import { Broken as InvoiceIssued } from '../../domain/events/broken.event.js';\n${ISSUED}`,
      ),
    ),
    inProject(
      EVENT_HANDLER,
      declaring('DomainEventHandler', `import { InvoiceIssued } from '../../domain/events/index.js';\n${ISSUED}`),
    ),
  ],
  invalid: [],
});
