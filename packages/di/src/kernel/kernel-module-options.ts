import type {
  ActorContext,
  Cache,
  Clock,
  CommandBus,
  DomainEventDispatcher,
  ErrorReporter,
  EventBus,
  EventSubscribers,
  ExecutionScope,
  IdGenerator,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  JobScheduler,
  Lock,
  Logger,
  Metrics,
  ProcessedEventStore,
  QueryBus,
  RateLimiter,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { Instrumentation } from './instrumentation.js';
import type { Provided } from './provided.js';

export interface KernelModuleOptions {
  readonly clock?: Provided<Clock>;
  readonly ids?: Provided<IdGenerator>;
  readonly unitOfWork?: Provided<UnitOfWork>;
  /** Handlers declared with `builder.command(...)` need a bus with `register`, such as the default. */
  readonly commandBus?: Provided<CommandBus>;
  readonly queryBus?: Provided<QueryBus>;
  readonly eventBus?: Provided<EventBus>;
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
   * What observes the application from outside, typically `traceApplication()` of
   * `@ddd-ts-kit/tracing`: the default buses, the event publisher, the consumers, the domain event
   * dispatcher, the jobs, the error reporter and every binding declared with a kind are wrapped
   * by it. A port given through an option above is wrapped too; one rebound by a later module is not.
   */
  readonly instrumentation?: Instrumentation;
}
