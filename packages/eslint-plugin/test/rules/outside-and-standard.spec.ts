import { aspectsOutsideIn } from '../../src/rules/aspects-outside-in.js';
import { standardNoParallelInterface } from '../../src/rules/standard-no-parallel-interface.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const MODULE = `${BILLING}/billing.module.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`;
const PORT = `${BILLING}/application/ports/logger.port.ts`;
const PUBLISHED = `${BILLING}/published-language/index.ts`;
const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;
const DECORATORS = "import { Retry } from '@ddd-ts-kit/aspects/decorators';";

ruleTester.run('aspects-outside-in', aspectsOutsideIn, {
  valid: [
    at(ADAPTER, DECORATORS),
    at('src/platform/payments/payment-client.ts', DECORATORS),
    at(
      MODULE,
      "import { retry, timeout } from '@ddd-ts-kit/aspects';\nbuilder.bind(GATEWAY).toClass(StripePaymentGateway, [CONFIG]).with(retry({ attempts: 3 }), timeout(2000));",
    ),
    at('src/main.ts', "import { aspects, logged } from '@ddd-ts-kit/aspects';"),
    at(SPEC, DECORATORS),
    at(`${BILLING}/infrastructure/external/stripe-payment.gateway.spec.ts`, DECORATORS),
    at(AGGREGATE, DECORATORS),
    at(HANDLER, DECORATORS),
    at('scripts/probe.ts', DECORATORS),
    at(ROUTE, DECORATORS, { ...SAMPLE_CONFIG, rules: { 'aspects/outside-in': 'off' } }),
    at(
      ROUTE,
      `// ddd-ts-kit-disable-next-line aspects/outside-in -- ADR-0009: the webhook route retries its own acknowledgement\n${DECORATORS}`,
    ),
  ],
  invalid: [
    { ...at(ROUTE, DECORATORS), errors: [{ messageId: 'decorators', data: { place: 'presentation/' } }] },
    {
      ...at(MODULE, DECORATORS),
      errors: [{ messageId: 'decorators', data: { place: 'the module file of "billing"' } }],
    },
    {
      ...at(PUBLISHED, "export { Logged } from '@ddd-ts-kit/aspects/decorators';"),
      errors: [{ messageId: 'decorators', data: { place: 'published-language/' } }],
    },
    {
      ...at('src/shared-kernel/money.vo.ts', DECORATORS),
      errors: [{ messageId: 'decorators', data: { place: 'the shared kernel' } }],
    },
    {
      ...at('src/main.ts', "const { Timed } = await import('@ddd-ts-kit/aspects/decorators');"),
      errors: [{ messageId: 'decorators', data: { place: 'src/main.ts' } }],
    },
    {
      ...at('src/apps/billing/main.ts', DECORATORS),
      errors: [{ messageId: 'decorators', data: { place: 'src/apps/billing/main.ts' } }],
    },
    {
      ...at('lib/infra/client.ts', DECORATORS, { ...SAMPLE_CONFIG, sourceRoot: 'lib', platformDir: 'lib/platform' }),
      errors: [{ messageId: 'decorators' }],
    },
  ],
});

ruleTester.run('standard-no-parallel-interface', standardNoParallelInterface, {
  valid: [
    at(
      `${BILLING}/infrastructure/external/sentry-reporter.adapter.ts`,
      'export class ErrorTracker implements ErrorReporter {}\nexport class CronScheduler implements JobScheduler {}\nexport class BackgroundJob implements ScheduledJob {}',
    ),
    at(
      PORT,
      "import type { Logger, Page, PageRequest } from '@ddd-ts-kit/kernel';\nexport interface InvoiceListing { list(request: PageRequest): Promise<Page<string>> }",
    ),
    at(
      ADAPTER,
      'export class PinoLogger implements Logger {}\nexport class StdoutLogger implements Logger {}\nexport class RedisCache implements Cache {}',
    ),
    at(
      ADAPTER,
      'export class CacheService implements kernel.Cache {}\nexport class AppLogger extends InMemoryLogger implements Logger {}',
    ),
    at(
      ADAPTER,
      "import { type ILogger } from './legacy.js';\nimport type IClock from './clock.js';\nconst logger: ILogger = make();",
    ),
    at(
      `${BILLING}/test/fakes/logger.fake.ts`,
      'export class FakeLogger implements Logger {}\nexport interface ILogger {}',
    ),
    at(`${BILLING}/application/ports/logger.port.spec.ts`, 'interface ILogger {}'),
    at(ROUTE, 'export interface RequestContext { readonly headers: HeaderValues }'),
    at('src/platform/http/request-context.ts', 'export interface RequestContext { readonly headers: HeaderValues }'),
    at(
      AGGREGATE,
      'export class UserSessionPolicy {}\nexport class PageLayout {}\nexport interface LoggerOptions {}\nexport class Session {}',
    ),
    at('scripts/openapi.ts', 'interface ILogger {}'),
    at(PORT, 'export interface CurrentUser { readonly id: string }', {
      ...SAMPLE_CONFIG,
      standardInterfaces: { CurrentUser: false },
    }),
    at(PORT, 'export interface ILogger {}', { ...SAMPLE_CONFIG, rules: { 'standard/no-parallel-interface': 'off' } }),
    at(
      PORT,
      '// ddd-ts-kit-disable-next-line standard/no-parallel-interface -- ADR-0011: AuditLog is the ledger of the audit context, defined in its glossary\nexport interface AuditLog {}',
    ),
  ],
  invalid: [
    {
      ...at(PORT, 'export interface ILogger { info(message: string): void }'),
      errors: [{ messageId: 'parallel', data: { name: 'ILogger', instead: 'Logger' } }],
    },
    {
      ...at(
        PORT,
        'export interface IJobScheduler {}\nexport class CronScheduler {}\nexport interface TaskScheduler {}\nexport class JobSchedulerService {}',
      ),
      errors: ['IJobScheduler', 'CronScheduler', 'TaskScheduler', 'JobSchedulerService'].map((name) => ({
        messageId: 'parallel' as const,
        data: { name, instead: 'JobScheduler' },
      })),
    },
    {
      ...at(
        PORT,
        'export interface IScheduledJob {}\nexport abstract class CronJob {}\nexport type ScheduledTask = () => void;\nexport class BackgroundJob {}',
      ),
      errors: ['IScheduledJob', 'CronJob', 'ScheduledTask', 'BackgroundJob'].map((name) => ({
        messageId: 'parallel' as const,
        data: { name, instead: 'ScheduledJob' },
      })),
    },
    {
      ...at(
        PORT,
        'export interface IErrorReporter {}\nexport class ErrorReporterService {}\nexport class ErrorTracker {}\nexport class ExceptionReporter {}\nexport class CrashReporter {}',
      ),
      errors: ['IErrorReporter', 'ErrorReporterService', 'ErrorTracker', 'ExceptionReporter', 'CrashReporter'].map(
        (name) => ({ messageId: 'parallel' as const, data: { name, instead: 'ErrorReporter' } }),
      ),
    },
    {
      ...at(
        PORT,
        'export interface AppLogger extends Logger {}\nexport type LoggerService = Logger;\nabstract class LoggerInterface {}',
      ),
      errors: [{ messageId: 'parallel' }, { messageId: 'parallel' }, { messageId: 'parallel' }],
    },
    {
      ...at(
        PORT,
        'export interface IMetrics {}\nexport interface MetricsService {}\nexport interface ICache {}\nexport class CacheService {}',
      ),
      errors: [
        { messageId: 'parallel', data: { name: 'IMetrics', instead: 'Metrics' } },
        { messageId: 'parallel' },
        { messageId: 'parallel', data: { name: 'ICache', instead: 'Cache' } },
        { messageId: 'parallel' },
      ],
    },
    {
      ...at('src/shared-kernel/user-context.ts', 'export type UserContext = Readonly<{ userId: string }>;'),
      errors: [{ messageId: 'parallel', data: { name: 'UserContext', instead: 'ExecutionContext or Actor' } }],
    },
    {
      ...at(HANDLER, 'interface CurrentUser {}\ninterface AuthContext {}\ninterface RequestContext {}'),
      errors: [{ messageId: 'parallel' }, { messageId: 'parallel' }, { messageId: 'parallel' }],
    },
    {
      ...at(
        AGGREGATE,
        'export interface UserSession {}\nexport type AuthSession = object;\nexport class SessionData {}',
      ),
      errors: [
        { messageId: 'parallel', data: { name: 'UserSession', instead: 'Session' } },
        { messageId: 'parallel' },
        { messageId: 'parallel' },
      ],
    },
    {
      ...at(
        ROUTE,
        'export interface PaginatedResponse<T> { items: T[] }\nexport interface PageParams { page: number }',
      ),
      errors: [
        { messageId: 'parallel', data: { name: 'PaginatedResponse', instead: 'Page' } },
        { messageId: 'parallel', data: { name: 'PageParams', instead: 'PageRequest' } },
      ],
    },
    {
      ...at(
        ADAPTER,
        'type PaginatedResult<T> = { rows: T[] };\ntype PageResult<T> = T[];\ninterface Paginated<T> {}\ninterface PaginationParams {}',
      ),
      errors: [
        { messageId: 'parallel' },
        { messageId: 'parallel' },
        { messageId: 'parallel' },
        { messageId: 'parallel' },
      ],
    },
    {
      ...at(
        ADAPTER,
        'export interface AuditLog {}\nexport interface AuditLogEntry {}\nexport interface AuditRecord {}',
      ),
      errors: [
        {
          messageId: 'parallel',
          data: { name: 'AuditLog', instead: 'AuditEntry of @ddd-ts-kit/audit (AuditStamp for audit columns)' },
        },
        { messageId: 'parallel' },
        { messageId: 'parallel' },
      ],
    },
    {
      ...at(
        PORT,
        'export interface IClock {}\nexport interface IIdGenerator {}\nexport interface IUnitOfWork {}\nexport interface ISession {}',
      ),
      errors: [
        { messageId: 'parallel', data: { name: 'IClock', instead: 'Clock' } },
        { messageId: 'parallel', data: { name: 'IIdGenerator', instead: 'IdGenerator' } },
        { messageId: 'parallel', data: { name: 'IUnitOfWork', instead: 'UnitOfWork' } },
        { messageId: 'parallel', data: { name: 'ISession', instead: 'Session' } },
      ],
    },
    { ...at(ADAPTER, 'export class CacheService implements Disposable {}'), errors: [{ messageId: 'parallel' }] },
    {
      ...at('src/platform/tenant.ts', 'export interface TenantInfo {}', {
        ...SAMPLE_CONFIG,
        standardInterfaces: { TenantInfo: 'TenantScoped' },
      }),
      errors: [{ messageId: 'parallel', data: { name: 'TenantInfo', instead: 'TenantScoped' } }],
    },
  ],
});
