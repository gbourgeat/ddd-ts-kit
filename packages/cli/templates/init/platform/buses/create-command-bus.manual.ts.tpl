import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
{{#if errors.none}}
{{#unless files.any}}
import { InMemoryCommandBus, unitOfWorkMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if files.any}}
import { InMemoryCommandBus, fileUploadsMiddleware, unitOfWorkMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
{{/if}}
{{/if}}
{{#if errors.sentry}}
import {
  InMemoryCommandBus,
  errorReportingMiddleware,
{{#if files.any}}
  fileUploadsMiddleware,
{{/if}}
  unitOfWorkMiddleware,
  type BusMiddleware,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#if cache.relaySignal}}
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
import type { Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if files.any}}
import type { Files } from '{{alias.platform}}/files/create-files{{alias.ext}}';
{{/if}}
{{#if cache.relaySignal}}
import type { RedisServices } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}

/** What the command bus puts around a handler, beyond what the foundations give. */
interface AroundCommands {
  /** The guard of the use cases: the permission, asked before any handler. */
  readonly guard: BusMiddleware;
  /** The storage whose unit of work a command runs in. */
  readonly persistence: Persistence;
{{#if files.any}}
  /** Where the file a command carries is staged, before its transaction. */
  readonly files: Files;
{{/if}}
{{#if cache.relaySignal}}
  /** Wakes the outbox relay as soon as a command committed; without a Redis protocol server (the tools, most tests) the relay only polls. */
  readonly redis: RedisServices | undefined;
{{/if}}
}

/**
{{#if errors.none}}
 * Around every command, outermost first: the log entry and the measure of the use case, the
{{/if}}
{{#if errors.sentry}}
 * Around every command, outermost first: the report of an unexpected failure (a failed commit
 * included), the log entry and the measure of the use case, the
{{/if}}
 * permission, the span of the use case (a refused command never started){{#if files.any}}, the staging of the file it carries{{/if}}{{#if cache.relaySignal}}, the wake-up of the outbox relay{{/if}}{{#if audit.on}}, the audit entry{{/if}}, then the unit of work.{{#if audit.on}} The audit entry
 * opens the transaction itself, so that the entry of a success commits with the state change
 * and the entry of a failure survives the rollback.{{/if}}
 */
export function createCommandBus(foundations: Foundations, around: AroundCommands): InMemoryCommandBus {
  return new InMemoryCommandBus()
{{#if errors.sentry}}
    .use(errorReportingMiddleware(foundations.errors, foundations.scope))
{{/if}}
    .use(loggingMiddleware(foundations.logger))
    .use(metricsMiddleware(foundations.metrics))
    .use(around.guard)
    .use(foundations.traced.useCase)
{{#if files.any}}
    .use(fileUploadsMiddleware(() => around.files))
{{/if}}
{{#if cache.relaySignal}}
    .use(wakingTheRelay(around.redis))
{{/if}}
{{#if audit.on}}
    .use(foundations.audit.commands)
{{/if}}
    .use(unitOfWorkMiddleware(around.persistence.unitOfWork));
}
{{#if cache.relaySignal}}

/** Without a Redis protocol server (the tools, most tests) the relay only polls. */
function wakingTheRelay(redis: RedisServices | undefined): BusMiddleware {
  return redis === undefined ? (_message, next) => next() : relayWakeUpMiddleware(redis.relaySignal);
}
{{/if}}
