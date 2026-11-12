import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { MONEY_GLOSSARY } from './shared-kernel-glossary';

const { ADAPTER, BILLING, MODULE, ROUTE } = PATHS;

const QUOTE_READER = `${BILLING}/infrastructure/external/remote-quote-reader.adapter.ts`;

export const STANDARD_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'aspects/timeout-covers-delegate',
    name: 'a delegating adapter that states its own policy, as long as the adapter behind the port it is given',
    expect: 'pass',
    files: project(delegation('.with(ownPolicy(timeout(120_000)))')),
  },
  {
    ruleId: 'aspects/timeout-covers-delegate',
    name: 'a delegating adapter that chose a shorter limit than the adapter it calls: failing fast is its choice',
    expect: 'pass',
    files: project(delegation('.with(ownPolicy(timeout(500)))')),
  },
  {
    ruleId: 'aspects/timeout-covers-delegate',
    name: 'a port bound again by rebind: which adapter serves it is known at run time only',
    expect: 'pass',
    files: project(delegation('', '  builder.rebind(ModelReader).toClass(FastModelReader);\n')),
  },
  {
    ruleId: 'aspects/timeout-covers-delegate',
    name: 'a slow adapter bound under a condition',
    expect: 'pass',
    files: project(delegation('', '', true)),
  },
  {
    ruleId: 'aspects/timeout-covers-delegate',
    name: 'a delegating adapter left to the default policy, cut before the adapter it calls',
    expect: { file: QUOTE_READER },
    files: project(delegation('')),
  },
  {
    ruleId: 'aspects/outside-in',
    name: 'decorators on an adapter and in the platform, wrappers bound in the module file',
    expect: 'pass',
    files: project({
      [ADAPTER]:
        "import { Retry } from '@ddd-ts-kit/aspects/decorators';\nexport class InMemoryInvoiceRepository {\n  @Retry({ attempts: 3 })\n  async find(): Promise<void> {}\n}\n",
      'src/platform/payments/payment-client.ts':
        "import { Timeout } from '@ddd-ts-kit/aspects/decorators';\nexport class PaymentClient {\n  @Timeout(2000)\n  async charge(): Promise<void> {}\n}\n",
      [MODULE]:
        "import { retry, timeout } from '@ddd-ts-kit/aspects';\nexport function billingModule(builder: Builder): void {\n  builder.bind(PaymentGateway).toClass(StripePaymentGateway, []).with(retry({ attempts: 3 }), timeout(2000));\n}\n",
    }),
  },
  {
    ruleId: 'aspects/outside-in',
    name: 'an aspect decorator in a route',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]:
        "import { Logged } from '@ddd-ts-kit/aspects/decorators';\nexport class IssueInvoiceRoute {\n  @Logged()\n  async handle(): Promise<void> {}\n}\n",
    }),
  },
  {
    ruleId: 'aspects/outside-in',
    name: 'an aspect decorator in the module file',
    expect: { file: MODULE },
    files: project({
      [MODULE]:
        "import { decoratorOf } from '@ddd-ts-kit/aspects/decorators';\nexport const billingModule = decoratorOf(audited);\n",
    }),
  },
  {
    ruleId: 'aspects/outside-in',
    name: 'an aspect decorator in the shared kernel',
    expect: { file: 'src/shared-kernel/money.vo.ts' },
    files: project({
      'src/shared-kernel/money.vo.ts':
        "import { Cached } from '@ddd-ts-kit/aspects/decorators';\nexport class Money {}\nexport { Cached };\n",
      ...MONEY_GLOSSARY,
    }),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'the kernel interfaces used and implemented under adapter names, the request context of a route, a dropped default',
    expect: 'pass',
    files: project(
      {
        [ADAPTER]:
          "import type { Logger, Page } from '@ddd-ts-kit/kernel';\nexport class InMemoryInvoiceRepository {\n  constructor(private readonly logger: Logger) {}\n\n  async search(): Promise<Page<string>> {\n    return { items: [] };\n  }\n}\n",
        [`${BILLING}/infrastructure/external/pino.logger.ts`]:
          "import type { Logger } from '@ddd-ts-kit/kernel';\n\nexport class PinoLogger implements Logger {}\n",
        [`${BILLING}/infrastructure/external/cache.service.ts`]:
          "import type { Cache } from '@ddd-ts-kit/kernel';\n\nexport class CacheService implements Cache {}\n",
        [`${BILLING}/presentation/http/request-context.dto.ts`]:
          "import { type ILogger } from '@/contexts/billing/presentation/http/legacy.js';\n\nexport interface RequestContext {\n  readonly logger: ILogger;\n}\n",
        'src/platform/current-user.ts': 'export interface CurrentUser {\n  readonly id: string;\n}\n',
      },
      { [CONFIG_FILE]: config({ standardInterfaces: { CurrentUser: false } }) },
    ),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'a home-made logger port',
    expect: { file: `${BILLING}/application/ports/i-logger.port.ts` },
    files: project({
      [`${BILLING}/application/ports/i-logger.port.ts`]:
        'export abstract class ILogger {\n  abstract info(message: string): void;\n}\n',
    }),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'a user context next to the execution context',
    expect: { file: 'src/shared-kernel/user-context.ts' },
    files: project({
      'src/shared-kernel/user-context.ts':
        'export type UserContext = Readonly<{ userId: string; tenantId: string }>;\n',
    }),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'a paginated result class, and a name added by the config',
    expect: { file: 'src/platform/paginated-result.ts' },
    files: project(
      {
        'src/platform/paginated-result.ts':
          'export class PaginatedResult<T> {\n  readonly items: readonly T[] = [];\n}\n\nexport type TenantInfo = Readonly<{ tenantId: string }>;\n',
      },
      { [CONFIG_FILE]: config({ standardInterfaces: { TenantInfo: 'TenantScoped' } }) },
    ),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'a home-made purger of the shared cache, next to the kernel port',
    expect: { file: 'src/platform/cdn-purger.ts' },
    files: project({
      'src/platform/cdn-purger.ts': 'export class CdnPurger {\n  purge(tags: readonly string[]): void {}\n}\n',
    }),
  },
  {
    ruleId: 'standard/no-parallel-interface',
    name: 'a home-made scheduler, and an error reporter behind an I',
    expect: { file: 'src/platform/cron-scheduler.ts' },
    files: project({
      'src/platform/cron-scheduler.ts':
        'export class CronScheduler {}\n\nexport type IErrorReporter = Readonly<{ report(error: unknown): void }>;\n',
    }),
  },
];

/** An adapter given the port of a slow one, the default settings of the platform, and the module that binds both. */
function delegation(policyOfTheDelegating: string, alsoBound = '', underCondition = false): Record<string, string> {
  const slow = "builder.bind(ModelReader).toClass(RemoteModelReader).as('external').with(ownPolicy(timeout(120_000)));";

  return {
    [QUOTE_READER]:
      'export class RemoteQuoteReader {\n  constructor(private readonly models: ModelReader) {}\n\n  read(): unknown {\n    return this.models;\n  }\n}\n',
    [`${BILLING}/infrastructure/external/remote-model-reader.adapter.ts`]: 'export class RemoteModelReader {}\n',
    'src/platform/resilience/default-resilience-settings.ts':
      'export const defaultResilienceSettings = { retryAttempts: 3, retryBaseDelayMs: 100, timeoutMs: 2000 };\n',
    [MODULE]: `import type { ContainerBuilder } from '@ddd-ts-kit/di';\nexport function billingModule(builder: ContainerBuilder): void {\n  builder.bind(QuoteReader).toClass(RemoteQuoteReader).as('external')${policyOfTheDelegating};\n${underCondition ? `  if (settings.remote) {\n    ${slow}\n  }` : `  ${slow}`}\n${alsoBound}}\n`,
  };
}
