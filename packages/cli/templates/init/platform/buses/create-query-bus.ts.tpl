import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { UseCaseGuard, type Resolve } from '@ddd-ts-kit/di';
{{#if errors.none}}
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if errors.sentry}}
import { ErrorReporter, InMemoryQueryBus, errorReportingMiddleware } from '@ddd-ts-kit/kernel';
{{/if}}
import type { Foundations } from '../lay-foundations.js';

/** Around every query, outermost first: {{#if errors.sentry}}the report of an unexpected failure, {{/if}}its log entry, its measure, the permission, its span{{#if audit.on}}, the audit entry of the reads that leave one{{/if}}. */
export function createQueryBus(resolve: Resolve, foundations: Foundations): InMemoryQueryBus {
  return new InMemoryQueryBus()
{{#if errors.sentry}}
    .use((message, next, info) =>
      errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)(message, next, info),
    )
{{/if}}
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
{{#if audit.on}}
    .use(foundations.traced.useCase)
    .use(foundations.audit.queries);
{{/if}}
{{#unless audit.on}}
    .use(foundations.traced.useCase);
{{/unless}}
}
