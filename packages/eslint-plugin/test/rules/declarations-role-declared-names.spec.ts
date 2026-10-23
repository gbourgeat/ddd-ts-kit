import { declarationsRoleDeclared } from '../../src/rules/declarations-role-declared';
import {
  DECLARED,
  DECLARATIONS,
  declaring,
  INTEGRATION_HANDLER,
  EVENT_HANDLER,
  POLICY,
  MAPPER,
  AGGREGATE,
} from '../support/declared-style';
import { at, BILLING, ruleTester } from '../support/rule-tester';

ruleTester.run('declarations-role-declared, the names of a declaration and the domain', declarationsRoleDeclared, {
  valid: [
    at(
      EVENT_HANDLER,
      declaring(
        'DomainEventHandler',
        "class InvoiceIssued { static readonly eventName = 'billing.invoice.issued'; readonly name = InvoiceIssued.eventName; }\n@DomainEventHandler(InvoiceIssued)\nexport class InvoiceIssuedEventHandler {}",
      ),
      DECLARED,
    ),
  ],
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
        `import * as declarations from '${DECLARATIONS}';\n@declarations.DomainEventHandler(InvoiceIssued)\nexport class InvoiceIssued {}`,
        DECLARED,
      ),
      errors: [{ messageId: 'inDomain', data: { className: 'InvoiceIssued', decorator: 'DomainEventHandler' } }],
    },
  ],
});
