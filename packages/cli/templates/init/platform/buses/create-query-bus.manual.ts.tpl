import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
{{#if errors.none}}
import { InMemoryQueryBus, type BusMiddleware } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if errors.sentry}}
import { InMemoryQueryBus, errorReportingMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
{{/if}}
import type { Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';

/** Around every query, outermost first: {{#if errors.sentry}}the report of an unexpected failure, {{/if}}its log entry, its measure, the permission (`guard`), its span{{#if audit.on}}, the audit entry of the reads that leave one{{/if}}. */
export function createQueryBus(foundations: Foundations, guard: BusMiddleware): InMemoryQueryBus {
  return new InMemoryQueryBus()
{{#if errors.sentry}}
    .use(errorReportingMiddleware(foundations.errors, foundations.scope))
{{/if}}
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use(guard)
{{#if audit.on}}
    .use(foundations.traced.useCase)
    .use(foundations.audit.queries);
{{/if}}
{{#unless audit.on}}
    .use(foundations.traced.useCase);
{{/unless}}
}
