import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { ADAPTER, BILLING, MODULE, ROUTE } = PATHS;

export const STANDARD_FIXTURES: readonly Fixture[] = [
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
