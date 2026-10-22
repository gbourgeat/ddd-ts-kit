import { cleanOneExportPerFile } from '../../src/rules/clean-one-export-per-file';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const TWO =
  'export function loggerOr(given?: Logger): Logger { return given ?? fallback(); }\nexport function clockOr(given?: Clock): Clock { return given ?? fallback(); }';

const WHY = 'the defaults of one runtime, read together';

ruleTester.run('clean-one-export-per-file: the file name', cleanOneExportPerFile, {
  valid: [
    at('src/platform/rabbit-mq-event-bus.ts', 'export class RabbitMqEventBus {}'),
    at('src/platform/type-orm-outbox-store.ts', 'export class TypeOrmOutboxStore {}'),
    at('src/platform/standard-schema-v1.ts', 'export interface StandardSchemaV1 {}'),
    at('src/platform/http-server.ts', 'export class HTTPServer {}'),
    at(`${BILLING}/domain/aggregates/invoice.aggregate.ts`, 'export class Invoice {}'),
    at(`${BILLING}/domain/value-objects/money.vo.ts`, 'export class Money {}'),
    at(`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`, 'export class IssueInvoiceHandler {}'),
    at(`${BILLING}/application/ports/payment-gateway.port.ts`, 'export abstract class PaymentGateway {}'),
    at(`${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`, 'export class KnexInvoiceRepository {}'),
    at(`${BILLING}/domain/repositories/invoice.repository.ts`, 'export abstract class InvoiceRepository {}'),
    at(`${BILLING}/application/scheduling/send-reminders.job.ts`, 'export class SendRemindersJob {}'),
    at(`${BILLING}/presentation/http/issue-invoice.route.ts`, 'export function issueInvoiceRoute(): void {}'),
    at(`${BILLING}/billing.module.ts`, 'export function billingModule(): void {}'),
    at(
      `${BILLING}/published-language/invoice-issued.v1.integration-event.ts`,
      'export const invoiceIssuedV1 = define();',
    ),
    at(
      `${BILLING}/application/authorization/billing.permissions.ts`,
      'export const billingPermissions = define();\nexport type BillingPermission = string;',
    ),
    at(
      'src/platform/decision.ts',
      'export type Decision = boolean;\nexport const ALLOWED: Decision = true;\nexport function deny(reason: string): Decision { return false; }',
    ),
    at(
      'src/platform/job-run-observer.ts',
      'export interface JobRunDetail { readonly id: string }\nexport type JobRunObserver = (detail: JobRunDetail) => void;',
    ),
    at(
      'src/platform/execution-context.ts',
      'export interface ExecutionContext { readonly id: string }\nexport function executionContext(): ExecutionContext { return { id: "" }; }',
    ),
    at('src/platform/anything.ts', 'export default function (): void {}'),
    { ...at('src/platform/logger-or.ts', TWO), options: [{ allow: [{ file: 'src/platform/*.ts', reason: WHY }] }] },
    at('src/platform/clock-or.ts', TWO, { onePerFile: { allow: [{ file: 'src/**/clock-or.ts', reason: WHY }] } }),
  ],
  invalid: [
    {
      ...at('src/platform/event-bus.ts', 'export class RabbitMqEventBus {}'),
      errors: [
        {
          messageId: 'fileName',
          data: { exported: 'RabbitMqEventBus', file: 'event-bus.ts', expected: 'rabbit-mq-event-bus.ts' },
        },
      ],
    },
    {
      ...at('src/platform/rabbitmq-event-bus.ts', 'export class RabbitMqEventBus {}'),
      errors: [{ messageId: 'fileName' }],
    },
    {
      ...at(`${BILLING}/domain/aggregates/invoices.aggregate.ts`, 'export class Invoice {}'),
      errors: [
        {
          messageId: 'fileName',
          data: { exported: 'Invoice', file: 'invoices.aggregate.ts', expected: 'invoice.aggregate.ts' },
        },
      ],
    },
    {
      ...at(`${BILLING}/application/commands/issue-invoice/issue.handler.ts`, 'export class IssueInvoiceHandler {}'),
      errors: [
        {
          messageId: 'fileName',
          data: { exported: 'IssueInvoiceHandler', file: 'issue.handler.ts', expected: 'issue-invoice-handler.ts' },
        },
      ],
    },
    {
      ...at(
        'src/platform/statement.ts',
        'export class Sql {}\nexport function sql(text: string): Sql { return new Sql(); }',
      ),
      errors: [{ messageId: 'fileName', data: { exported: 'Sql', file: 'statement.ts', expected: 'sql.ts' } }],
    },
    {
      ...at('src/platform/collaborators.ts', TWO),
      options: [{ allow: [{ file: 'src/platform/collaborators.ts', reason: WHY }] }],
      errors: [
        {
          messageId: 'fileName',
          data: { exported: 'loggerOr or clockOr', file: 'collaborators.ts', expected: 'logger-or.ts' },
        },
      ],
    },
    {
      ...at('src/platform/collaborators.ts', TWO),
      options: [{ allow: [{ file: 'src/platform/collaborators.ts', reason: ' ' }] }],
      errors: [{ messageId: 'several' }],
    },
    {
      ...at('src/platform/collaborators.ts', TWO, {
        onePerFile: { allow: [{ file: 'src/platform/collaborators.ts' }, 'src/platform/collaborators.ts'] },
      }),
      errors: [{ messageId: 'several' }],
    },
  ],
});

ruleTester.run('clean-one-export-per-file: entry files', cleanOneExportPerFile, {
  valid: [
    at(
      'src/platform/index.ts',
      "import 'reflect-metadata';\nexport * from './a.js';\nexport { b, type B } from './b.js';\nexport type { C } from './c.js';\nexport * as d from './d.js';",
    ),
    at('packages/pino/src/index.ts', 'export {};', {}),
    at(
      `${BILLING}/billing.declarations.ts`,
      "import { injected } from '@ddd-ts-kit/kernel/declarations';\nimport { A } from './application/a.handler.js';\nexport * from './application/a.handler.js';\nexport * from './infrastructure/b.repository.js';\ninjected(A, [B]);",
    ),
    at(`${BILLING}/billing.dependencies.ts`, "import { A } from './application/a.handler.js';\ninjected(A, [B]);"),
    at(
      `${BILLING}/application/commands/commands.declarations.ts`,
      "import { injected } from '@ddd-ts-kit/kernel/declarations';\nimport { A } from './a/a.handler.js';\nexport * from './a/a.command.js';\nexport * from './a/a.handler.js';\ninjected(A, [B]);",
    ),
    at(
      `${BILLING}/infrastructure/infrastructure.declarations.ts`,
      "export * from './a.gateway.js';\nexport * from './b.adapter.js';",
    ),
    {
      ...at('packages/kernel/src/declarations.ts', "export * from './declarations/a.js';", {}),
      options: [{ entries: ['packages/*/src/declarations.ts'] }],
    },
  ],
  invalid: [
    {
      ...at(
        'src/platform/index.ts',
        "export * from './a.js';\nexport const VERSION = '1';\nexport function make(): void {}",
      ),
      errors: [
        { messageId: 'entry', line: 2 },
        { messageId: 'entry', line: 3 },
      ],
    },
    {
      ...at('src/platform/index.ts', "import { a } from './a.js';\nexport { a };\nexport default a;"),
      errors: [
        { messageId: 'entry', line: 1 },
        { messageId: 'entry', line: 2 },
        { messageId: 'entry', line: 3 },
      ],
    },
    {
      ...at('packages/kernel/src/declarations.ts', 'export interface Token {}\nexport function token(): void {}', {}),
      options: [{ entries: ['packages/*/src/declarations.ts'] }],
      errors: [{ messageId: 'entry' }, { messageId: 'entry' }],
    },
    {
      ...at('packages/kernel/src/declarations.ts', 'export interface Token {}\nexport function token(): void {}', {}),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        `${BILLING}/domain/events/events.declarations.ts`,
        'export class InvoiceIssued {}\nexport class InvoicePaid {}',
      ),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        `${BILLING}/application/commands/queries.declarations.ts`,
        'export class IssueInvoice {}\nexport class PayInvoice {}',
      ),
      errors: [{ messageId: 'several' }],
    },
  ],
});
