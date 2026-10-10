import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { UseCaseGuard, type Resolve } from '@ddd-ts-kit/di';
{{#if errors.none}}
{{#if cache.relaySignal}}
import { InMemoryCommandBus, UnitOfWork, unitOfWorkMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
{{#unless cache.relaySignal}}
import { InMemoryCommandBus, UnitOfWork, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
{{/unless}}
{{/if}}
{{#if errors.sentry}}
{{#if cache.relaySignal}}
import {
  ErrorReporter,
  InMemoryCommandBus,
  UnitOfWork,
  errorReportingMiddleware,
  unitOfWorkMiddleware,
  type BusMiddleware,
} from '@ddd-ts-kit/kernel';
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
{{#unless cache.relaySignal}}
import {
  ErrorReporter,
  InMemoryCommandBus,
  UnitOfWork,
  errorReportingMiddleware,
  unitOfWorkMiddleware,
} from '@ddd-ts-kit/kernel';
{{/unless}}
{{/if}}
import type { Foundations } from '../lay-foundations.js';
{{#if cache.relaySignal}}
import type { RedisServices } from '../redis/open-redis.js';

interface Signalled {
  readonly redis?: RedisServices;
}
{{/if}}

/**
{{#if errors.none}}
 * Around every command, outermost first: the log entry and the measure of the use case, the
{{/if}}
{{#if errors.sentry}}
 * Around every command, outermost first: the report of an unexpected failure (a failed commit
 * included), the log entry and the measure of the use case, the
{{/if}}
 * permission, the span of the use case (a refused command never started){{#if cache.relaySignal}}, the wake-up of the outbox relay{{/if}}{{#if audit.on}}, the audit entry{{/if}}, then the unit of work. The guard and the unit of
 * work are resolved at each command: building the bus must not open anything.{{#if audit.on}} The audit entry
 * opens the transaction itself, so that the entry of a success commits with the state change
 * and the entry of a failure survives the rollback.{{/if}}
 */
{{#if cache.relaySignal}}
export function createCommandBus(resolve: Resolve, foundations: Foundations, options: Signalled): InMemoryCommandBus {
{{/if}}
{{#unless cache.relaySignal}}
export function createCommandBus(resolve: Resolve, foundations: Foundations): InMemoryCommandBus {
{{/unless}}
  return new InMemoryCommandBus()
{{#if errors.sentry}}
    .use((message, next, info) =>
      errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)(message, next, info),
    )
{{/if}}
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
    .use(foundations.traced.useCase)
{{#if cache.relaySignal}}
    .use(wakingTheRelay(options.redis))
{{/if}}
{{#if audit.on}}
    .use(foundations.audit.commands)
{{/if}}
    .use(unitOfWorkMiddleware({ run: (work) => resolve(UnitOfWork).run(work) }));
}
{{#if cache.relaySignal}}

/** Without a Redis protocol server (the tools, most tests) the relay only polls. */
function wakingTheRelay(redis: RedisServices | undefined): BusMiddleware {
  return redis === undefined ? (_message, next) => next() : relayWakeUpMiddleware(redis.relaySignal);
}
{{/if}}
