import type {
  ActorContext,
  Cache,
  CacheInvalidation,
  Clock,
  CommandBus,
  DomainEventDispatcher,
  ErrorReporter,
  EventBus,
  EventBusFailures,
  EventSubscribers,
  ExecutionScope,
  IdGenerator,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  JobQueue,
  JobScheduler,
  Lock,
  Logger,
  Metrics,
  ProcessStore,
  ProcessedEventStore,
  QueryBus,
  RateLimiter,
  TenantDirectory,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { JobStore, QueueWorker, QueueWorkerOptions } from '@ddd-ts-kit/scheduling';
import type { Instrumentation } from './instrumentation';
import type { Provided } from './provided';

export interface KernelModuleOptions {
  readonly clock?: Provided<Clock>;
  readonly ids?: Provided<IdGenerator>;
  readonly unitOfWork?: Provided<UnitOfWork>;
  /** Handlers declared with `builder.command(...)` need a bus with `register`, such as the default. */
  readonly commandBus?: Provided<CommandBus>;
  readonly queryBus?: Provided<QueryBus>;
  readonly eventBus?: Provided<EventBus>;
  /**
   * How the default event bus, `InMemoryEventBus`, rejects when its handlers fail: `as-thrown`
   * rethrows the failure of a single handler as it is. Default `aggregated`, which becomes
   * `as-thrown` in a later minor version. Ignored when `eventBus` is given.
   */
  readonly eventBusFailures?: EventBusFailures;
  /** Defaults to the event bus. An outbox goes here. */
  readonly eventPublisher?: Provided<IntegrationEventPublisher>;
  /** Defaults to the event bus. A broker adapter goes here. */
  readonly eventSubscriber?: Provided<IntegrationEventSubscriber>;
  /**
   * Defaults to `eventSubscriber` for every context. A broker that gives each consuming context
   * its own subscriber goes here: `{ forContext: (name) => bus.forConsumer(name) }`.
   */
  readonly eventSubscribers?: Provided<EventSubscribers>;
  readonly processedEvents?: Provided<ProcessedEventStore>;
  /** Defaults to a dispatcher inside this process, which the declared domain event handlers are attached to. */
  readonly domainEvents?: Provided<DomainEventDispatcher>;
  /** Defaults to the actor of the execution scope, so the two cannot disagree. */
  readonly actorContext?: Provided<ActorContext>;
  /** Defaults to one following the asynchronous call chain of each unit of work. */
  readonly executionScope?: Provided<ExecutionScope>;
  /** Defaults to a logger that writes nothing. The application flushes it when it stops, after the error reporter. */
  readonly logger?: Provided<Logger>;
  /** Defaults to metrics that measure nothing. */
  readonly metrics?: Provided<Metrics>;
  /**
   * Defaults to a reporter that reports nothing. The default buses and the default job scheduler
   * hand it their unexpected failures, and the application flushes it when it stops.
   */
  readonly errorReporter?: Provided<ErrorReporter>;
  /** Defaults to a bounded cache in the memory of the process, expiring by `Clock`. */
  readonly cache?: Provided<Cache>;
  /**
   * Defaults to purge requests published on `eventPublisher`: behind an outbox they commit with the
   * work, and the relay hands them to a `CachePurger` through `PurgingPublisher`. Without one, the
   * requests reach the event bus, where nothing purges.
   */
  readonly cacheInvalidation?: Provided<CacheInvalidation>;
  /** Defaults to a lock inside this process, expiring by `Clock`: several instances exclude nothing between them. */
  readonly lock?: Provided<Lock>;
  /** Defaults to a limiter inside this process, counting by `Clock`: several instances each allow the limit. */
  readonly rateLimiter?: Provided<RateLimiter>;
  /**
   * Defaults to a scheduler inside this process, on `Clock`, `Lock`, `ExecutionScope`,
   * `IdGenerator`, `Logger`, `Metrics` and `ErrorReporter`: with the default lock, several instances
   * each run every job.
   */
  readonly jobScheduler?: Provided<JobScheduler>;
  /**
   * The tenants that exist, bound as `TenantDirectory`: a job declared `tenancy: 'per-tenant'` runs
   * once for each, in its execution scope, on the default scheduler. Absent: no directory is
   * bound, and the default scheduler refuses such a job when it is registered.
   */
  readonly tenants?: Provided<TenantDirectory>;
  /**
   * Where the background jobs wait. Defaults to a store in the memory of the process: bind the
   * jobs table of the ORM package (`KnexJobStore`, `DrizzleJobStore`), or `RedisJobStore`, so that
   * a job survives a restart and is shared by the workers.
   */
  readonly jobStore?: Provided<JobStore>;
  /** Defaults to a queue on `jobStore` that captures the correlation, the actor, the tenant and the trace of the work. */
  readonly jobQueue?: Provided<JobQueue>;
  /** Defaults to a worker on `jobStore`, `Clock`, `ExecutionScope`, `Logger`, `Metrics` and `ErrorReporter`, tuned by `queues`. */
  readonly queueWorker?: Provided<QueueWorker>;
  /**
   * Where the process managers keep their instances. Defaults to the memory of the process: bind
   * `KnexProcessStore` or `DrizzleProcessStore` so that a step saves its state in the transaction
   * of its unit of work. `ProcessRunner` is always the one of `@ddd-ts-kit/scheduling`, on it.
   */
  readonly processStore?: Provided<ProcessStore>;
  /** Concurrency per queue, polling interval and grace period of the default worker. */
  readonly queues?: Pick<QueueWorkerOptions, 'concurrency' | 'pollIntervalMs' | 'graceMs'>;
  /**
   * What observes the application from outside, typically `traceApplication()` of
   * `@ddd-ts-kit/tracing`: the default buses, the event publisher, the consumers, the domain event
   * dispatcher, the jobs, the error reporter and every binding declared with a kind are wrapped
   * by it. A port given through an option above is wrapped too; one rebound by a later module is not.
   */
  readonly instrumentation?: Instrumentation;
}
