import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { UseCaseGuard, type Resolve } from '@ddd-ts-kit/di';
import { ErrorReporter, InMemoryQueryBus, errorReportingMiddleware } from '@ddd-ts-kit/kernel';
import type { Foundations } from '@/platform/lay-foundations.js';

/** Around every query, outermost first: the report of an unexpected failure, its log entry, its measure, the permission, its span, the audit entry of the reads that leave one. */
export function createQueryBus(resolve: Resolve, foundations: Foundations): InMemoryQueryBus {
  return new InMemoryQueryBus()
    .use((message, next, info) =>
      errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)(message, next, info),
    )
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
    .use(foundations.traced.useCase)
    .use(foundations.audit.queries);
}
