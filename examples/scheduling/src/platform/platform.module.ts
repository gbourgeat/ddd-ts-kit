import type { Authenticator } from '@ddd-ts-kit/auth';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { defineContextModule, type ContextModule, type ModuleBuilder } from '@ddd-ts-kit/di';
import { OutboxStore } from '@ddd-ts-kit/events';
import { ErrorMapper, createErrorMapper } from '@ddd-ts-kit/http';
import {
  Cache,
  EventSubscribers,
  ExecutionScope,
  Lock,
  Metrics,
  ProcessedEventStore,
  RateLimiter,
  UnitOfWork,
  type ErrorReporter,
} from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';
import type { ConsumerTrace } from '@ddd-ts-kit/tracing';
import { createTupleStore } from '@/platform/auth/create-tuple-store';
import type { Persistence } from '@/platform/database/persistence';
import type { EventProvider } from '@/platform/events/event-provider';
import type { LogSettings } from '@/platform/observability/create-logger';
import type { RedisServices } from '@/platform/redis/open-redis';
import { adapterAspects } from '@/platform/resilience/adapter-aspects';
import { defaultResilience } from '@/platform/resilience/default-resilience';
import type { ResilienceSettings } from '@/platform/resilience/resilience-settings';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';
import { KnexAppointmentExport } from '@/contexts/scheduling/infrastructure/persistence/knex-appointment-export.repository';
import { errorStatuses } from '@/platform/http/error-statuses';
// ddd-ts-kit:imports
import { PersonDirectoryContract } from '@/contexts/identity/published-language/index';
import { AppointmentExportContract } from '@/contexts/scheduling/published-language/index';
// /ddd-ts-kit:imports

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
  /** The policy around every adapter that leaves the process; left out, the defaults of `resilience/default-resilience.ts`. */
  readonly resilience?: ResilienceSettings;
  /** Whether a consumed event continues the trace of its publication (the default) or starts one linked to it. */
  readonly traceConsumers?: ConsumerTrace;
  /** Where unexpected failures are reported: the reporter of `errors.ts` in `main.ts`; left out (the tools, the tests), nowhere. */
  readonly errors?: ErrorReporter;
  /** The Redis protocol server; left out, the cache, the lock and the limiter stay in the memory of the process. */
  readonly redis?: RedisServices;
  /** The networks served, each a tenant (ADR-0003): a job declared per tenant runs once for each; left out (the tools), for none. */
  readonly networks?: readonly string[];
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
      builder.bind(KnexContext).toValue(persistence.database);
      builder.bind(OutboxStore).toValue(persistence.outbox);
      // One store for the authorizer and for the adapters that keep relationships in sync: an adapter names `RelationTupleStore` in its dependencies and writes in the unit of work of its command.
      builder.bind(RelationTupleStore).toValue(createTupleStore(persistence.database));
      builder.rebind(EventSubscribers).toValue({ forContext: (name) => options.events.forConsumer(name) });
      builder.bind(ErrorMapper).toValue(createErrorMapper(errorStatuses));
      // Cross-cutting behaviour stays out of the contexts. Inside the span and the dispatch the kernel module puts around a binding, outside the aspects a binding states for itself (`ownPolicy`).
      builder.around(['external', 'gateway'], () => adapterAspects(options.resilience ?? defaultResilience));

      if (options.redis !== undefined) {
        bindRedis(builder, options.redis);
      }

      // ddd-ts-kit:bindings
      builder
        .bind(PersonDirectoryContract)
        .toFactory((resolve) => new KnexPersonDirectory(persistence.database, resolve(ExecutionScope)));

      builder
        .bind(AppointmentExportContract)
        .toFactory((resolve) => new KnexAppointmentExport(persistence.database, resolve(ExecutionScope)));
      // /ddd-ts-kit:bindings
    },
  });
}

/** One server for the cache, the limiter in front of HTTP and the lock that keeps a scheduled job to one instance. */
function bindRedis(builder: ModuleBuilder, redis: RedisServices): void {
  builder.rebind(Cache).toFactory((resolve) => redis.cache(resolve(Metrics)));
  builder.rebind(RateLimiter).toValue(redis.rateLimiter);
  builder.rebind(Lock).toValue(redis.lock);
}
