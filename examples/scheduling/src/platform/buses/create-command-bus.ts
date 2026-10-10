import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { UseCaseGuard, type Resolve } from '@ddd-ts-kit/di';
import { ErrorReporter, InMemoryCommandBus, UnitOfWork, errorReportingMiddleware, unitOfWorkMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
import type { Foundations } from '../lay-foundations.js';
import type { RedisServices } from '../redis/open-redis.js';
import { readOnlyImpersonation } from './read-only-impersonation.js';

interface Signalled {
  readonly redis?: RedisServices;
}

/**
 * Around every command, outermost first: the report of an unexpected failure (a failed commit
 * included), the log entry and the measure of the use case, the
 * permission, the span of the use case (a refused command never started), the wake-up of the outbox relay, the audit entry, the refusal of whoever
 * impersonates (inside the audit entry, which records the refused command and its impersonator), then the unit of work. The guard and the unit of
 * work are resolved at each command: building the bus must not open anything. The audit entry
 * opens the transaction itself, so that the entry of a success commits with the state change
 * and the entry of a failure survives the rollback.
 */
export function createCommandBus(resolve: Resolve, foundations: Foundations, options: Signalled): InMemoryCommandBus {
  return new InMemoryCommandBus()
    .use((message, next, info) => errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)(message, next, info))
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))
    .use(foundations.traced.useCase)
    .use(wakingTheRelay(options.redis))
    .use(foundations.audit.commands)
    .use(readOnlyImpersonation(foundations.scope))
    .use(unitOfWorkMiddleware({ run: (work) => resolve(UnitOfWork).run(work) }));
}

/** Without a Redis protocol server (the tools, most tests) the relay only polls. */
function wakingTheRelay(redis: RedisServices | undefined): BusMiddleware {
  return redis === undefined ? (_message, next) => next() : relayWakeUpMiddleware(redis.relaySignal);
}
