import { declarationsRoleDeclared } from '../../src/rules/declarations-role-declared.js';
import { inProject } from '../support/declared-project.js';
import {
  DECLARED,
  DECLARATIONS,
  declaring,
  INTEGRATION_HANDLER,
  EVENT_HANDLER,
  PUBLISHER,
  POLICY,
  MAPPER,
  AGGREGATE,
} from '../support/declared-style.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const ISSUED =
  "@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })\nexport class InvoiceIssuedEventHandler { async handle(event: InvoiceIssued): Promise<void> {} }";

const ISSUED_EVENT = "import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';";

ruleTester.run('declarations-role-declared, the names of a declaration and the domain', declarationsRoleDeclared, {
  valid: [],
  invalid: [
    {
      ...at(
        INTEGRATION_HANDLER,
        declaring(
          'IntegrationEventHandler',
          '@IntegrationEventHandler(productListedV1, { consumer: NAME }, [])\nexport class CatalogProductListedHandler {}',
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'name',
          data: {
            decorator: 'IntegrationEventHandler',
            className: 'CatalogProductListedHandler',
            key: 'consumer',
            problem: 'not a string literal',
            context: 'billing',
          },
        },
      ],
    },
    {
      ...at(
        POLICY,
        declaring('Policy', '@Policy(permission, { name: `billing.${rule}` })\nexport class OnlyIssuerVoidsPolicy {}'),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'name',
          data: {
            decorator: 'Policy',
            className: 'OnlyIssuerVoidsPolicy',
            key: 'name',
            problem: 'not a string literal',
            context: 'billing',
          },
        },
      ],
    },
    {
      ...at(POLICY, declaring('Policy', '@Policy(permission)\nexport class OnlyIssuerVoidsPolicy {}'), DECLARED),
      errors: [
        {
          messageId: 'name',
          data: {
            decorator: 'Policy',
            className: 'OnlyIssuerVoidsPolicy',
            key: 'name',
            problem: 'missing',
            context: 'billing',
          },
        },
      ],
    },
    {
      ...at(
        EVENT_HANDLER,
        declaring(
          'DomainEventHandler',
          "@DomainEventHandler(InvoiceIssued, { name: '' })\nexport class InvoiceIssuedEventHandler {}",
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'name',
          data: {
            decorator: 'DomainEventHandler',
            className: 'InvoiceIssuedEventHandler',
            key: 'name',
            problem: 'empty',
            context: 'billing',
          },
        },
      ],
    },
    {
      ...at(MAPPER, declaring('Policy', 'const inline = @Policy(permission, options) class {};'), DECLARED),
      errors: [
        {
          messageId: 'name',
          data: {
            decorator: 'Policy',
            className: 'the class',
            key: 'name',
            problem: 'not a string literal',
            context: 'billing',
          },
        },
      ],
    },
    {
      ...at(
        EVENT_HANDLER,
        declaring('DomainEventHandler', `class InvoiceIssued { readonly name = 'billing.invoice.paid'; }\n${ISSUED}`),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'eventName',
          data: {
            className: 'InvoiceIssuedEventHandler',
            declared: 'billing.invoice.issued',
            event: 'InvoiceIssued',
            actual: 'billing.invoice.paid',
          },
        },
      ],
    },
    {
      ...inProject(
        PUBLISHER,
        declaring(
          'DomainEventHandler',
          `${ISSUED_EVENT.replace('../../', '../../../')}\n@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.sent' }, [IntegrationEventPublisher])\nexport class InvoiceIssuedPublisher {}`,
        ),
      ),
      errors: [
        {
          messageId: 'eventName',
          data: {
            className: 'InvoiceIssuedPublisher',
            declared: 'billing.invoice.sent',
            event: 'InvoiceIssued',
            actual: 'billing.invoice.issued',
          },
        },
      ],
    },
    {
      ...inProject(
        EVENT_HANDLER,
        declaring(
          'DomainEventHandler',
          `import { InvoiceIssued as Issued } from '#src/contexts/billing/domain/events/invoice-issued.event.js';\n@DomainEventHandler(Issued, { name: 'billing.invoice.sent' })\nexport class InvoiceIssuedEventHandler {}`,
        ),
      ),
      errors: [
        {
          messageId: 'eventName',
          data: {
            className: 'InvoiceIssuedEventHandler',
            declared: 'billing.invoice.sent',
            event: 'Issued',
            actual: 'billing.invoice.issued',
          },
        },
      ],
    },
    {
      ...at(AGGREGATE, declaring('Repository', '@Repository(INVOICES)\nexport class Invoice {}'), DECLARED),
      errors: [{ messageId: 'inDomain', data: { className: 'Invoice', decorator: 'Repository' } }],
    },
    {
      ...at(
        `${BILLING}/domain/services/numbering.service.ts`,
        declaring(
          'Adapter as Bound, Policy',
          "@Bound(NUMBERING)\nclass Numbering {}\n@Policy(p, { name: 'billing.x' })\nexport class Rule {}",
        ),
        DECLARED,
      ),
      errors: [
        { messageId: 'inDomain', data: { className: 'Numbering', decorator: 'Adapter' } },
        { messageId: 'inDomain', data: { className: 'Rule', decorator: 'Policy' } },
      ],
    },
    {
      ...at(
        `${BILLING}/domain/events/invoice-issued.event.ts`,
        `import * as declarations from '${DECLARATIONS}';\n@declarations.DomainEventHandler(InvoiceIssued, { name: NAME })\nexport class InvoiceIssued {}`,
        DECLARED,
      ),
      errors: [{ messageId: 'inDomain', data: { className: 'InvoiceIssued', decorator: 'DomainEventHandler' } }],
    },
  ],
});
