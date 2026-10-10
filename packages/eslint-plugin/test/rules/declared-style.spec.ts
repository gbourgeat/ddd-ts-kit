import { authzDeclared } from '../../src/rules/authz-declared.js';
import { authzInApplication } from '../../src/rules/authz-in-application.js';
import { layerApplicationInward } from '../../src/rules/layer-application-inward.js';
import { layerDomainPurity } from '../../src/rules/layer-domain-purity.js';
import { inProject } from '../support/declared-project.js';
import {
  DECLARED,
  EXPLICIT,
  DECLARATIONS,
  declaring,
  MODULE,
  COMMAND,
  QUERY,
  HANDLER,
  QUERY_HANDLER,
  POLICY,
  REPOSITORY,
  ROUTE,
  AGGREGATE,
  SPEC,
} from '../support/declared-style.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const REGISTERS_DECORATED =
  "import { IssueInvoiceCommand } from './application/commands/issue-invoice/issue-invoice.command.js';\nimport { ListInvoicesQuery as ListInvoices } from '@/contexts/billing/application/queries/list-invoices/list-invoices.query.js';\nbuilder.command(IssueInvoiceCommand).handledBy(IssueInvoiceHandler, [INVOICES]);\nbuilder.query(ListInvoices).handledBy(ListInvoicesHandler, [INVOICES]);";

ruleTester.run('authz-declared in the declared style', authzDeclared, {
  valid: [
    at(
      COMMAND,
      declaring(
        'Requires',
        "@Requires(billingPermissions['invoice.issue'])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}",
      ),
      DECLARED,
    ),
    at(QUERY, declaring('Public', '@Public()\nexport class GetCatalogQuery extends Query<Catalog> {}'), DECLARED),
    at(
      QUERY,
      declaring(
        'Public as Open',
        '@Open()\nclass GetCatalogQuery extends Query<Catalog> {}\nexport { GetCatalogQuery };',
      ),
      DECLARED,
    ),
    at(
      COMMAND,
      `import * as declarations from '${DECLARATIONS}';\n@declarations.Requires(permission)\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}`,
      DECLARED,
    ),
    at(COMMAND, 'class Draft {}\nexport type IssueInvoiceInput = { readonly customerId: string };', DECLARED),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', EXPLICIT),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}'),
    at(HANDLER, 'export class IssueInvoiceHandler {}', DECLARED),
    at(`${BILLING}/application/ports/issue-invoice.command.ts`, 'export class IssueInvoiceCommand {}', DECLARED),
    at(`${BILLING}/test/unit/issue-invoice.command.ts`, 'export class IssueInvoiceCommand {}', DECLARED),
    at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', {
      ...DECLARED,
      rules: { 'authz/declared': 'off' },
    }),
    at(
      MODULE,
      declaring(
        'Public',
        '@Public()\nclass Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);',
      ),
    ),
    inProject(MODULE, REGISTERS_DECORATED, EXPLICIT),
    inProject(MODULE, REGISTERS_DECORATED),
  ],
  invalid: [
    {
      ...at(COMMAND, 'export class IssueInvoiceCommand extends AuthorizedCommand<string> {}', DECLARED),
      errors: [{ messageId: 'message', data: { kind: 'command', className: 'IssueInvoiceCommand' } }],
    },
    {
      ...at(
        QUERY,
        'class ListInvoicesQuery extends AuthorizedQuery<Invoice[]> {}\nexport default ListInvoicesQuery;',
        DECLARED,
      ),
      errors: [{ messageId: 'message', data: { kind: 'query', className: 'ListInvoicesQuery' } }],
    },
    {
      ...at(
        COMMAND,
        "import { Requires } from './home-made.js';\n@Requires(permission)\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}",
        DECLARED,
      ),
      errors: [{ messageId: 'message' }],
    },
    {
      ...at(
        COMMAND,
        declaring(
          'CommandHandler',
          '@CommandHandler(Other, [])\nexport class IssueInvoiceCommand extends AuthorizedCommand<string> {}',
        ),
        DECLARED,
      ),
      errors: [{ messageId: 'message' }],
    },
    {
      ...at(
        COMMAND,
        declaring(
          'Requires',
          '@Requires(a)\nexport class A extends AuthorizedCommand<string> {}\nexport class B extends AuthorizedCommand<string> {}',
        ),
        DECLARED,
      ),
      errors: [{ messageId: 'message', data: { kind: 'command', className: 'B' } }],
    },
    {
      ...at(MODULE, 'class Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);'),
      errors: [{ messageId: 'useCase' }],
    },
    {
      ...at(
        MODULE,
        "import { Requires } from './home-made.js';\n@Requires(p)\nclass Health extends Query<string> {}\nbuilder.query(Health).handledBy(HealthHandler);",
        DECLARED,
      ),
      errors: [{ messageId: 'useCase' }],
    },
    {
      ...inProject(
        MODULE,
        "import { VoidInvoiceCommand } from './application/commands/void-invoice/void-invoice.command.js';\nimport { PayInvoiceCommand } from './application/commands/pay-invoice/pay-invoice.command.js';\nimport { Missing } from './application/commands/missing/missing.command.js';\nbuilder.command(VoidInvoiceCommand).handledBy(A);\nbuilder.command(PayInvoiceCommand).handledBy(B);\nbuilder.command(Missing).handledBy(C);",
        EXPLICIT,
      ),
      errors: [
        { messageId: 'useCase', data: { kind: 'command', name: 'VoidInvoiceCommand', binding: 'handledBy' } },
        { messageId: 'useCase', line: 5 },
        { messageId: 'useCase', line: 6 },
      ],
    },
  ],
});

ruleTester.run('authz-in-application in the declared style', authzInApplication, {
  valid: [
    at(COMMAND, declaring('Requires, Public', ''), DECLARED),
    at(POLICY, declaring('Policy', "import { Access } from '@ddd-ts-kit/auth';"), DECLARED),
    at(
      QUERY_HANDLER,
      `import { Access, PolicyAccess } from '@ddd-ts-kit/auth';\nimport { QueryHandler } from '${DECLARATIONS}';`,
      DECLARED,
    ),
    at(
      REPOSITORY,
      declaring(
        'Repository',
        "import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';\nimport { Authorizer, RoleBasedAuthorizer } from '@ddd-ts-kit/auth';",
      ),
      DECLARED,
    ),
    at(ROUTE, declaring('type DeclaredClass', "import { CommandBus } from '@ddd-ts-kit/kernel';"), DECLARED),
    at(REPOSITORY, declaring('Requires, Public, Policy', "import { Access } from '@ddd-ts-kit/auth';"), EXPLICIT),
    at(ROUTE, declaring('Requires, Public, Policy', '')),
    at(SPEC, declaring('Requires, Policy', "import { Access } from '@ddd-ts-kit/auth';"), DECLARED),
    at('src/platform/auth/access.ts', declaring('Policy', "import { Access } from '@ddd-ts-kit/auth';"), DECLARED),
  ],
  invalid: [
    {
      ...at(ROUTE, declaring('Requires, Public as Open, type DeclaredClass', ''), DECLARED),
      errors: [
        { messageId: 'declaredOutside', data: { layer: 'presentation', name: 'Requires', specifier: DECLARATIONS } },
        { messageId: 'declaredOutside', data: { layer: 'presentation', name: 'Public', specifier: DECLARATIONS } },
      ],
    },
    {
      ...at(ROUTE, "import { Access } from '@ddd-ts-kit/auth';", DECLARED),
      errors: [{ messageId: 'authorizerImport', data: { name: 'Access' } }],
    },
    {
      ...at(
        REPOSITORY,
        declaring('Policy, Repository', "import { Access, type PolicyAccess } from '@ddd-ts-kit/auth';"),
        DECLARED,
      ),
      errors: [
        { messageId: 'declaredOutside', data: { layer: 'infrastructure', name: 'Policy', specifier: DECLARATIONS } },
        {
          messageId: 'declaredOutside',
          data: { layer: 'infrastructure', name: 'Access', specifier: '@ddd-ts-kit/auth' },
        },
        {
          messageId: 'declaredOutside',
          data: { layer: 'infrastructure', name: 'PolicyAccess', specifier: '@ddd-ts-kit/auth' },
        },
      ],
    },
    {
      ...at(
        REPOSITORY,
        `export { Requires } from '${DECLARATIONS}';\nawait this.access.authorize(actor, permission, row);`,
        DECLARED,
      ),
      errors: [{ messageId: 'declaredOutside' }, { messageId: 'decision' }],
    },
    {
      ...at(AGGREGATE, "import { Access } from '@ddd-ts-kit/auth';", DECLARED),
      errors: [{ messageId: 'authInDomain' }],
    },
  ],
});

ruleTester.run('layer-application-inward in the declared style', layerApplicationInward, {
  valid: [
    at(
      HANDLER,
      declaring(
        'CommandHandler, type DeclaredClass',
        "import { Clock, DomainEventDispatcher, IdGenerator } from '@ddd-ts-kit/kernel';",
      ),
      DECLARED,
    ),
    at(HANDLER, declaring('CommandHandler', ''), { ...DECLARED, applicationAllowedPackages: ['decimal.js'] }),
    at(HANDLER, declaring('CommandHandler', ''), EXPLICIT),
    at(HANDLER, declaring('CommandHandler', '')),
    at(REPOSITORY, declaring('Repository', "import { knex } from 'knex';"), DECLARED),
  ],
  invalid: [
    {
      ...at(HANDLER, declaring('CommandHandler', ''), { ...EXPLICIT, applicationAllowedPackages: ['decimal.js'] }),
      errors: [{ messageId: 'package', data: { name: '@ddd-ts-kit/kernel', context: 'billing' } }],
    },
    {
      ...at(HANDLER, "import type { Clock } from '@ddd-ts-kit/kernel';", {
        ...DECLARED,
        applicationAllowedPackages: ['decimal.js'],
      }),
      errors: [{ messageId: 'package' }],
    },
    {
      ...at(
        HANDLER,
        "import { Retry } from '@ddd-ts-kit/aspects/decorators';\nimport { KnexInvoiceRepository } from '../../../infrastructure/persistence/knex-invoice.repository.js';",
        DECLARED,
      ),
      errors: [{ messageId: 'outsideConcern' }, { messageId: 'outward' }],
    },
  ],
});

ruleTester.run('layer-domain-purity in the declared style', layerDomainPurity, {
  valid: [
    at(AGGREGATE, "import { AggregateRoot } from '@ddd-ts-kit/kernel';", DECLARED),
    at(AGGREGATE, declaring('type Token', ''), EXPLICIT),
    at(AGGREGATE, declaring('type Token', '')),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, declaring('CommandHandler', ''), DECLARED),
    at(REPOSITORY, declaring('Repository', ''), DECLARED),
  ],
  invalid: [
    { ...at(AGGREGATE, declaring('Repository', ''), DECLARED), errors: [{ messageId: 'declarations' }] },
    {
      ...at(
        `${BILLING}/domain/repositories/invoice.repository.ts`,
        `import type { Token } from '${DECLARATIONS}';`,
        DECLARED,
      ),
      errors: [{ messageId: 'declarations' }],
    },
    {
      ...at(AGGREGATE, `const declarations = await import('${DECLARATIONS}');`, {
        ...DECLARED,
        domainAllowedPackages: ['@ddd-ts-kit/kernel'],
      }),
      errors: [{ messageId: 'declarations' }],
    },
    { ...at(AGGREGATE, "import { z } from 'zod';", DECLARED), errors: [{ messageId: 'package' }] },
  ],
});
