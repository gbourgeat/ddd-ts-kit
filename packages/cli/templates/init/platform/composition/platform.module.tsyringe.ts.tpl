{{#if http.any}}
import type { Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
{{#if cache.redis}}
import { defineContextModule, type ContextModule, type ModuleBuilder } from '@ddd-ts-kit/di';
{{/if}}
{{#unless cache.redis}}
import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
{{/unless}}
{{#if events.outbox}}
import { OutboxStore } from '@ddd-ts-kit/events';
{{/if}}
{{#if http.any}}
import { ErrorMapper, createErrorMapper } from '@ddd-ts-kit/http';
{{/if}}
{{#if cache.redis}}
{{#if broker.external}}
import {
  Cache,
  EventSubscribers,
  Lock,
  Metrics,
  ProcessedEventStore,
  {{#if queue.processTable}}
  ProcessStore,
  {{/if}}
  RateLimiter,
  UnitOfWork,
  {{#if errors.sentry}}
  type ErrorReporter,
  {{/if}}
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless broker.external}}
{{#if errors.sentry}}
import {
  Cache,
  Lock,
  Metrics,
  ProcessedEventStore,
  {{#if queue.processTable}}
  ProcessStore,
  {{/if}}
  RateLimiter,
  UnitOfWork,
  type ErrorReporter,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless errors.sentry}}
import { Cache, Lock, Metrics, ProcessedEventStore, {{#if queue.processTable}}ProcessStore, {{/if}}RateLimiter, UnitOfWork } from '@ddd-ts-kit/kernel';
{{/unless}}
{{/unless}}
{{/if}}
{{#unless cache.redis}}
import { {{#if broker.external}}EventSubscribers, {{/if}}ProcessedEventStore, UnitOfWork{{#if errors.sentry}}, type ErrorReporter{{/if}} } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#unless cache.redis}}
{{#if queue.processTable}}
import { ProcessStore } from '@ddd-ts-kit/kernel';
{{/if}}
{{/unless}}
{{#if queue.redis}}
import { Logger } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if queue.stored}}
import { JobStore } from '@ddd-ts-kit/scheduling';
{{/if}}
{{#if persistence.packagedToken}}
import { {{persistence.token}} } from '{{persistence.tokenPackage}}';
{{/if}}
{{#if persistence.ownDatabase}}
import { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
{{/if}}
import type { ConsumerTrace } from '@ddd-ts-kit/tracing';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';
import type { LogSettings } from '{{alias.platform}}/observability/create-logger{{alias.ext}}';
{{#if cache.redis}}
import type { RedisServices } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}
import { defaultPolicy } from '{{alias.platform}}/resilience/default-policy{{alias.ext}}';
import { defaultResilienceSettings } from '{{alias.platform}}/resilience/default-resilience-settings{{alias.ext}}';
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings{{alias.ext}}';
{{#if style.declared}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports
{{/if}}

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
  {{#if http.any}}
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
  {{/if}}
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** The policy around every adapter that leaves the process; left out, `resilience/default-resilience-settings.ts`. */
  readonly resilience?: ResilienceSettings;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
  {{#if errors.sentry}}
  /** Where unexpected failures are reported: the reporter of `errors.ts` in `main.ts`; left out (the tools, the tests), nowhere. */
  readonly errors?: ErrorReporter;
  {{/if}}
  {{#if cache.redis}}
  {{#if queue.redis}}
  /**
   * The Redis protocol server, which `main.ts` and the worker always give; left out (the tools,
   * the tests), the cache, the lock, the limiter and the background jobs stay in the memory of
   * the process, whose jobs only this process runs.
   */
  {{/if}}
  {{#unless queue.redis}}
  /** The Redis protocol server; left out, the cache, the lock and the limiter stay in the memory of the process. */
  {{/unless}}
  readonly redis?: RedisServices;
  {{/if}}
}

/**
 * What this platform puts in place of the in-process defaults of the kernel module: the storage
 * and whatever else `main.ts` opened for it. Replacing a provider happens here and nowhere else.
 */
export function platformModule(persistence: Persistence, options: PlatformOptions): ContextModule {
  return defineContextModule({
    name: 'platform',
    // Closed inside `stop()` of the application, after the jobs and the consumers and before the logger is flushed.
    onStop: () => options.events.close(),
    register(builder) {
      builder.rebind(UnitOfWork).toValue(persistence.unitOfWork);
      builder.rebind(ProcessedEventStore).toValue(persistence.processedEvents);
      {{#if persistence.hasDatabase}}
      builder.bind({{persistence.token}}).toValue(persistence.database);
      {{/if}}
      {{#if events.outbox}}
      builder.bind(OutboxStore).toValue(persistence.outbox);
      {{/if}}
      {{#if queue.database}}
      builder.rebind(JobStore).toValue(persistence.jobs);
      {{/if}}
      {{#if queue.processTable}}
      builder.rebind(ProcessStore).toValue(persistence.processes);
      {{/if}}
      {{#if broker.external}}
      builder.rebind(EventSubscribers).toValue({ forContext: (name) => options.events.forConsumer(name) });
      {{/if}}
      {{#if http.any}}
      builder.bind(ErrorMapper).toValue(createErrorMapper());
      {{/if}}
      // Cross-cutting behaviour stays out of the contexts. Inside the span and the dispatch the kernel module puts around a binding, outside the aspects a binding states for itself (`ownPolicy`).
      builder.around(['external', 'gateway'], () => defaultPolicy(options.resilience ?? defaultResilienceSettings));
      {{#if cache.redis}}

      if (options.redis !== undefined) {
        bindRedis(builder, options.redis{{#if queue.redis}}{{#if errors.sentry}}, options.errors{{/if}}{{/if}});
      }
      {{/if}}
      {{#if style.declared}}
      {{#if cache.redis}}

      {{/if}}
      // ddd-ts-kit:bindings
      // /ddd-ts-kit:bindings
      {{/if}}
    },
  });
}
{{#if cache.redis}}

{{#if queue.redis}}
/** One server for the cache, the limiter in front of HTTP, the lock of the scheduled jobs and the background jobs. */
{{/if}}
{{#unless queue.redis}}
/** One server for the cache, the limiter in front of HTTP and the lock that keeps a scheduled job to one instance. */
{{/unless}}
function bindRedis(builder: ModuleBuilder, redis: RedisServices{{#if queue.redis}}{{#if errors.sentry}}, errors?: ErrorReporter{{/if}}{{/if}}): void {
  builder.rebind(Cache).toFactory((resolve) => redis.cache(resolve(Metrics)));
  builder.rebind(RateLimiter).toValue(redis.rateLimiter);
  builder.rebind(Lock).toValue(redis.lock);
  {{#if queue.redis}}
  builder.rebind(JobStore).toFactory((resolve) => redis.jobs(resolve(Logger){{#if errors.sentry}}, errors{{/if}}));
  {{/if}}
}
{{/if}}
