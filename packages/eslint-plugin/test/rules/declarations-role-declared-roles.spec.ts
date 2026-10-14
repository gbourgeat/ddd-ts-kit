import { declarationsRoleDeclared } from '../../src/rules/declarations-role-declared.js';
import {
  DECLARED,
  declaring,
  HANDLER,
  QUERY_HANDLER,
  INTEGRATION_HANDLER,
  EVENT_HANDLER,
  PUBLISHER,
  POLICY,
  JOB,
  REPOSITORY,
  GATEWAY,
  ADAPTER,
} from '../support/declared-style.js';
import { at, ruleTester } from '../support/rule-tester.js';

const role = (suffix: string, folder: string, expected: string): Record<string, string> => ({
  suffix,
  folder,
  expected,
});

ruleTester.run(
  'declarations-role-declared, a role left undeclared or declared in the wrong place',
  declarationsRoleDeclared,
  {
    valid: [],
    invalid: [
      {
        ...at(HANDLER, 'export class IssueInvoiceHandler {}', DECLARED),
        errors: [
          {
            messageId: 'undeclared',
            data: role('handler', 'application/commands', 'CommandHandler'),
            line: 1,
            column: 14,
          },
        ],
      },
      {
        ...at(HANDLER, 'export const handle = (): void => undefined;', DECLARED),
        errors: [{ messageId: 'undeclared', line: 1, column: 1 }],
      },
      {
        ...at(
          HANDLER,
          declaring('CommandHandler', '@CommandHandler(IssueInvoiceCommand, [])\nclass IssueInvoiceHandler {}'),
          DECLARED,
        ),
        errors: [{ messageId: 'undeclared' }],
      },
      {
        ...at(
          HANDLER,
          "import { CommandHandler } from './home-made.js';\n@CommandHandler(IssueInvoiceCommand, [])\nexport class IssueInvoiceHandler {}",
          DECLARED,
        ),
        errors: [{ messageId: 'undeclared' }],
      },
      {
        ...at(
          HANDLER,
          declaring('QueryHandler', '@QueryHandler(SearchInvoicesQuery, [])\nexport class IssueInvoiceHandler {}'),
          DECLARED,
        ),
        errors: [
          {
            messageId: 'wrongRole',
            data: {
              ...role('handler', 'application/commands', 'CommandHandler'),
              className: 'IssueInvoiceHandler',
              actual: 'QueryHandler',
            },
          },
        ],
      },
      {
        ...at(
          QUERY_HANDLER,
          declaring(
            'CommandHandler as Handles',
            '@Handles(IssueInvoiceCommand, [])\nexport class SearchInvoicesHandler {}',
          ),
          DECLARED,
        ),
        errors: [
          {
            messageId: 'wrongRole',
            data: {
              ...role('handler', 'application/queries', 'QueryHandler'),
              className: 'SearchInvoicesHandler',
              actual: 'CommandHandler',
            },
          },
        ],
      },
      {
        ...at(
          REPOSITORY,
          declaring(
            'Adapter, Repository',
            '@Repository(A, [])\nexport class KnexInvoiceRepository {}\n@Adapter(B, {})\nclass Cache {}',
          ),
          DECLARED,
        ),
        errors: [
          {
            messageId: 'wrongRole',
            line: 4,
            data: {
              ...role('repository', 'infrastructure/persistence', 'Repository'),
              className: 'Cache',
              actual: 'Adapter',
            },
          },
        ],
      },
      {
        ...at(
          INTEGRATION_HANDLER,
          declaring(
            'CommandHandler',
            '@CommandHandler(IssueInvoiceCommand, [])\nexport class CatalogProductListedHandler {}',
          ),
          DECLARED,
        ),
        errors: [
          {
            messageId: 'wrongRole',
            data: {
              ...role('integration-handler', 'application/integration/handlers', 'IntegrationEventHandler'),
              className: 'CatalogProductListedHandler',
              actual: 'CommandHandler',
            },
          },
        ],
      },
      {
        ...at(EVENT_HANDLER, 'export class InvoiceIssuedEventHandler {}', DECLARED),
        errors: [
          { messageId: 'undeclared', data: role('event-handler', 'application/event-handlers', 'DomainEventHandler') },
        ],
      },
      {
        ...at(JOB, 'export class SendRemindersJob implements ScheduledJob {}', DECLARED),
        errors: [{ messageId: 'undeclared', data: role('job', 'application/scheduling', 'Scheduled') }],
      },
      {
        ...at(
          JOB,
          declaring('CommandHandler', '@CommandHandler(SendRemindersCommand, [])\nexport class SendRemindersJob {}'),
          DECLARED,
        ),
        errors: [
          {
            messageId: 'wrongRole',
            data: {
              ...role('job', 'application/scheduling', 'Scheduled'),
              className: 'SendRemindersJob',
              actual: 'CommandHandler',
            },
          },
        ],
      },
      {
        ...at(
          HANDLER,
          declaring(
            'Scheduled',
            "@Scheduled('billing.send-reminders', { every: '15m' }, [])\nexport class IssueInvoiceHandler {}",
          ),
          DECLARED,
        ),
        errors: [{ messageId: 'wrongRole' }],
      },
      {
        ...at(GATEWAY, 'export class InProcessPriceCatalogGateway {}', DECLARED),
        errors: [{ messageId: 'undeclared', data: role('gateway', 'infrastructure', 'Gateway') }],
      },
      {
        ...at(
          ADAPTER,
          declaring('Gateway', '@Gateway(PaymentProvider)\nexport class RemotePaymentProvider {}'),
          DECLARED,
        ),
        errors: [{ messageId: 'wrongRole' }],
      },
      {
        ...at(PUBLISHER, 'export class InvoiceIssuedPublisher {}', DECLARED),
        errors: [
          {
            messageId: 'undeclared',
            data: role('publisher', 'application/integration/publishers', 'DomainEventHandler'),
          },
        ],
      },
      {
        ...at(
          INTEGRATION_HANDLER,
          declaring(
            'DomainEventHandler',
            '@DomainEventHandler(InvoiceIssued)\nexport class CatalogProductListedHandler {}',
          ),
          DECLARED,
        ),
        errors: [{ messageId: 'wrongRole' }],
      },
      {
        ...at(POLICY, declaring('Requires', '@Requires(permission)\nexport class OnlyIssuerVoidsPolicy {}'), DECLARED),
        errors: [
          {
            messageId: 'wrongRole',
            data: {
              ...role('policy', 'application/authorization', 'Policy'),
              className: 'OnlyIssuerVoidsPolicy',
              actual: 'Requires',
            },
          },
        ],
      },
    ],
  },
);
