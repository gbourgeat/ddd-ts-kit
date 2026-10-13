import { authzDeclared } from '../../src/rules/authz-declared.js';
import { presentationControllerDelegates } from '../../src/rules/presentation-controller-delegates.js';
import { presentationControllerShape } from '../../src/rules/presentation-controller-shape.js';
import { presentationGuardAtTheEdge } from '../../src/rules/presentation-guard-at-the-edge.js';
import { presentationSharedCacheVaries } from '../../src/rules/presentation-shared-cache-varies.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const CONTROLLER = `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`;
const GUARD = `${BILLING}/presentation/http/guards/office-hours.guard.ts`;
const HTTP = "import { Controller, Guard, Public } from '@ddd-ts-kit/http';\n";
const declared = (options: string): string => `@Controller({ ${options}, response: { status: 204 } })`;
const POST = declared("group: InvoicesRoutes, method: 'POST', path: '/'");
const GET = declared("group: InvoicesRoutes, method: 'GET', path: '/'");

ruleTester.run('presentation-controller-shape', presentationControllerShape, {
  valid: [
    at(
      CONTROLLER,
      `${HTTP}const body = 1;\n${POST}\nexport class IssueInvoiceController { constructor(private readonly commands: CommandBus) {} async handle(): Promise<void> { this.step(); } private step(): void {} }\nfunction helper(): void {}`,
    ),
    at(
      CONTROLLER,
      "import { Controller } from '@nestjs/common';\n@Controller('invoices')\nexport class InvoicesController { list(): void {} create(): void {} }",
    ),
    at(
      `${BILLING}/test/unit/issue-invoice.controller.spec.ts`,
      `${HTTP}${POST}\nexport class IssueInvoiceController { run(): void {} }`,
    ),
    at(
      `${BILLING}/presentation/http/issue-invoice.route.ts`,
      `${HTTP}${POST}\nexport class IssueInvoiceController { run(): void {} }`,
    ),
  ],
  invalid: [
    {
      ...at(CONTROLLER, `${HTTP}${POST}\nexport class IssueInvoiceController { async execute(): Promise<void> {} }`),
      errors: [
        { messageId: 'missingHandle' },
        { messageId: 'extraPublicMethod', data: { className: 'IssueInvoiceController', name: 'execute' } },
      ],
    },
    {
      ...at(
        CONTROLLER,
        `${HTTP}${POST}\nexport class IssueInvoiceController { handle(): void {} static of(): void {} }\nexport class IssueInvoiceMapper {}`,
      ),
      errors: [
        { messageId: 'extraPublicMethod' },
        { messageId: 'severalClasses', data: { className: 'IssueInvoiceMapper' } },
      ],
    },
  ],
});

ruleTester.run('presentation-controller-delegates', presentationControllerDelegates, {
  valid: [
    at(
      CONTROLLER,
      `${HTTP}${POST}\nexport class IssueInvoiceController { constructor(private readonly commands: CommandBus, private readonly mapper: IssueInvoiceMapper) {} handle(): void {} }`,
    ),
    at(
      CONTROLLER,
      `${HTTP}${GET}\nexport class GetInvoiceController { constructor(private readonly queries: QueryBus, private readonly serializer: InvoiceSerializer) {} handle(): void {} }`,
    ),
    at(
      CONTROLLER,
      `${HTTP}const spec = {};\n@Controller(spec)\nexport class AnyController { constructor(private readonly queries: QueryBus) {} handle(): void {} }`,
    ),
    at(
      CONTROLLER,
      `${HTTP}@Controller({ ...route, method: verb })\nexport class AnyController { constructor(private readonly queries: QueryBus) {} handle(): void {} }`,
    ),
    at(CONTROLLER, 'export class PlainController { constructor(private readonly invoices: InvoiceRepository) {} }'),
    at(
      'src/platform/audit/search-audit-entries.controller.ts',
      `${HTTP}${GET}\nexport class AuditController { constructor(private readonly reader: AuditReader) {} handle(): void {} }`,
    ),
  ],
  invalid: [
    {
      ...at(
        CONTROLLER,
        `${HTTP}${POST}\nexport class IssueInvoiceController { constructor(private readonly commands: CommandBus, private readonly invoices: InvoiceRepository, clock) {} handle(): void {} }`,
      ),
      errors: [
        { messageId: 'foreignDependency', data: { className: 'IssueInvoiceController', type: 'InvoiceRepository' } },
        { messageId: 'foreignDependency', data: { className: 'IssueInvoiceController', type: 'an untyped value' } },
      ],
    },
    {
      ...at(
        CONTROLLER,
        `${HTTP}${GET}\nexport class GetInvoiceController { constructor(private readonly commands: CommandBus) {} handle(): void {} }`,
      ),
      errors: [
        { messageId: 'missingBus', data: { className: 'GetInvoiceController', method: 'GET', expected: 'QueryBus' } },
        { messageId: 'wrongBus' },
      ],
    },
    {
      ...at(CONTROLLER, `${HTTP}${POST}\nexport class IssueInvoiceController { handle(): void {} }`),
      errors: [{ messageId: 'missingBus' }],
    },
  ],
});

ruleTester.run('presentation-guard-at-the-edge', presentationGuardAtTheEdge, {
  valid: [
    at(
      GUARD,
      "import { Guard } from '@ddd-ts-kit/http';\nimport { ApiKeys } from '@/contexts/billing/application/ports/api-keys.port';\nimport type { QueryBus } from '@ddd-ts-kit/kernel';\nexport class OfficeHoursGuard {}",
    ),
    at(
      `${BILLING}/presentation/http/invoices.routes.ts`,
      "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';",
    ),
    at(
      `${BILLING}/test/unit/office-hours.guard.spec.ts`,
      "import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';",
    ),
  ],
  invalid: [
    {
      ...at(
        GUARD,
        "import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';\nimport { Pool } from '../../../infrastructure/persistence/pool';",
      ),
      errors: [
        {
          messageId: 'reachesInside',
          data: { specifier: '@/contexts/billing/domain/aggregates/invoice.aggregate', layer: 'domain' },
        },
        { messageId: 'reachesInside' },
      ],
    },
    {
      ...at(
        'src/platform/http/guards/tenant.guard.ts',
        "import { CommandBus, UnitOfWork as Work } from '@ddd-ts-kit/kernel';\nimport Repository from 'somewhere';\nimport * as InvoiceRepository from '@/x';",
      ),
      errors: [
        { messageId: 'reachesName', data: { name: 'CommandBus' } },
        { messageId: 'reachesName', data: { name: 'UnitOfWork' } },
        { messageId: 'reachesName' },
        { messageId: 'reachesName' },
      ],
    },
  ],
});

ruleTester.run('authz-declared, on a controller', authzDeclared, {
  valid: [
    at(CONTROLLER, `${HTTP}${POST}\nexport class IssueInvoiceController {}`),
    at(
      CONTROLLER,
      `${HTTP}${declared("method: 'GET', path: '/rates', guards: [Public]")}\nexport class GetRatesController {}`,
    ),
    at(
      CONTROLLER,
      `${HTTP}@Controller({ ...route, method: 'GET', response })\nexport class AnyController {}\n@Controller(spec)\nexport class OtherController {}`,
    ),
    at(
      CONTROLLER,
      "import { Controller } from '@nestjs/common';\n@Controller('invoices')\nexport class InvoicesController {}\n@Controller({ path: 'invoices' })\nexport class OtherController {}",
    ),
  ],
  invalid: [
    {
      ...at(CONTROLLER, `${HTTP}${declared("method: 'GET', path: '/rates'")}\nexport class GetRatesController {}`),
      errors: [{ messageId: 'controller' }],
    },
  ],
});

const GROUP = `${BILLING}/presentation/http/invoices.routes.ts`;
const ROUTE_FILE = `${BILLING}/presentation/http/rates.route.ts`;
const SHARED = "cache: { scope: CacheScope.public, maxAge: '1m' }";

ruleTester.run('presentation-shared-cache-varies', presentationSharedCacheVaries, {
  valid: [
    at(
      CONTROLLER,
      `${HTTP}${declared(`method: 'GET', path: '/rates', guards: [Public], ${SHARED}`)}\nexport class GetRatesController {}`,
    ),
    at(
      CONTROLLER,
      `${HTTP}${declared(`group: InvoicesRoutes, method: 'GET', path: '/', ${SHARED}`)}\nexport class ListInvoicesController {}`,
    ),
    at(
      GROUP,
      `${HTTP}@RouteGroup({ prefix: '/invoices', guards: [Authenticated], cache: { scope: CacheScope.public, maxAge: '1m', vary: ['Authorization'] } })\nexport class InvoicesRoutes {}`,
    ),
    at(
      GROUP,
      `${HTTP}@RouteGroup({ prefix: '/invoices', guards: [Authenticated], cache: { scope: CacheScope.private, maxAge: '0s' } })\nexport class InvoicesRoutes {}`,
    ),
    at(ROUTE_FILE, `defineRoute({ operationId: 'readRates', security: false, ${SHARED} }, handler);`),
    at(ROUTE_FILE, `defineRoute({ operationId: 'readRates', security: ['bearer'], cache }, handler);`),
    at(
      `${BILLING}/test/unit/invoices.routes.spec.ts`,
      `RouteGroup({ guards: [Authenticated], ${SHARED} })(InvoicesRoutes);`,
    ),
  ],
  invalid: [
    {
      ...at(
        GROUP,
        `${HTTP}@RouteGroup({ prefix: '/invoices', guards: [Authenticated], ${SHARED} })\nexport class InvoicesRoutes {}`,
      ),
      errors: [
        { messageId: 'sharedWithoutVary', data: { what: 'route group', why: 'it stands behind Authenticated' } },
      ],
    },
    {
      ...at(
        CONTROLLER,
        `${HTTP}${declared("group: InvoicesRoutes, method: 'GET', path: '/', guards: [HasRole('auditor')], cache: { scope: 'public', maxAge: '1m', vary: [] }")}\nexport class ListInvoicesController {}`,
      ),
      errors: [{ messageId: 'sharedWithoutVary', data: { what: 'controller', why: 'it stands behind a guard' } }],
    },
    {
      ...at(ROUTE_FILE, `defineRoute({ operationId: 'readRates', security: ['bearer'], ${SHARED} }, handler);`),
      errors: [{ messageId: 'sharedWithoutVary', data: { what: 'route', why: 'it names security schemes' } }],
    },
  ],
});
