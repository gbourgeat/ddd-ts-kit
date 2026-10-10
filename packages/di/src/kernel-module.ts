import {
  AsyncLocalStorageExecutionScope,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryProcessedEventStore,
  InMemoryQueryBus,
  InMemoryRateLimiter,
  InMemoryUnitOfWork,
  NoopLogger,
  NoopMetrics,
  ScopedActorContext,
  SystemClock,
  UuidGenerator,
  unitOfWorkMiddleware,
  type ActorContext,
  type Cache,
  type Clock,
  type CommandBus,
  type DomainEventDispatcher,
  type EventBus,
  type ExecutionScope,
  type IdGenerator,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
  type JobScheduler,
  type Lock,
  type Logger,
  type Metrics,
  type ProcessedEventStore,
  type QueryBus,
  type RateLimiter,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';
import { useCaseGuard } from './authorization.js';
import {
  ACTOR_CONTEXT,
  CACHE,
  CLOCK,
  COMMAND_BUS,
  DOMAIN_EVENTS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  JOB_SCHEDULER,
  LOCK,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
  RATE_LIMITER,
  UNIT_OF_WORK,
} from './kernel-tokens.js';
import { defineContextModule, type ContextModule, type ModuleBuilder, type Resolve } from './module.js';

/** An instance, or a factory when it needs other bindings. A port is never itself a function. */
export type Provided<T> = T | ((resolve: Resolve) => T);

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
  readonly processedEvents?: Provided<ProcessedEventStore>;
  /** Defaults to a dispatcher inside this process, which the declared domain event handlers are attached to. */
  readonly domainEvents?: Provided<DomainEventDispatcher>;
  /** Defaults to the actor of the execution scope, so the two cannot disagree. */
  readonly actorContext?: Provided<ActorContext>;
  /** Defaults to one following the asynchronous call chain of each unit of work. */
  readonly executionScope?: Provided<ExecutionScope>;
  /** Defaults to a logger that writes nothing. */
  readonly logger?: Provided<Logger>;
  /** Defaults to metrics that measure nothing. */
  readonly metrics?: Provided<Metrics>;
  /** Defaults to a bounded cache in the memory of the process, expiring by `CLOCK`. */
  readonly cache?: Provided<Cache>;
  /** Defaults to a lock inside this process, expiring by `CLOCK`: several instances exclude nothing between them. */
  readonly lock?: Provided<Lock>;
  /** Defaults to a limiter inside this process, counting by `CLOCK`: several instances each allow the limit. */
  readonly rateLimiter?: Provided<RateLimiter>;
  /**
   * Defaults to a scheduler inside this process, on `CLOCK`, `LOCK`, `EXECUTION_SCOPE`,
   * `ID_GENERATOR`, `LOGGER` and `METRICS`: with the default lock, several instances each run every job.
   */
  readonly jobScheduler?: Provided<JobScheduler>;
}

/**
 * Binds the kernel tokens to in-process defaults: system clock, UUIDs, in-memory buses, a
 * command bus running every command in the unit of work, both buses asking the use case guard
 * first. Replace one through the options,
 * or from a later module with `builder.rebind(TOKEN)`.
 */
export function kernelModule(options: KernelModuleOptions = {}): ContextModule {
  return defineContextModule({
    name: 'kernel',
    register(builder) {
      builder.bind(CLOCK).toFactory(either(options.clock, () => new SystemClock()));
      builder.bind(ID_GENERATOR).toFactory(either(options.ids, () => new UuidGenerator()));
      builder.bind(UNIT_OF_WORK).toFactory(either(options.unitOfWork, () => new InMemoryUnitOfWork()));
      builder.bind(COMMAND_BUS).toFactory(either(options.commandBus, transactionalCommandBus));
      builder.bind(QUERY_BUS).toFactory(either(options.queryBus, guardedQueryBus));
      builder.bind(EVENT_BUS).toFactory(either(options.eventBus, () => new InMemoryEventBus()));
      builder.bind(EVENT_PUBLISHER).toFactory(either(options.eventPublisher, (resolve) => resolve(EVENT_BUS)));
      builder.bind(EVENT_SUBSCRIBER).toFactory(either(options.eventSubscriber, (resolve) => resolve(EVENT_BUS)));
      builder
        .bind(PROCESSED_EVENTS)
        .toFactory(either(options.processedEvents, () => new InMemoryProcessedEventStore()));
      bindCrossCuttingPorts(builder, options);
    },
  });
}

function bindCrossCuttingPorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  builder
    .bind(EXECUTION_SCOPE)
    .toFactory(either(options.executionScope, () => new AsyncLocalStorageExecutionScope()));
  builder.bind(ACTOR_CONTEXT).toFactory(either(options.actorContext, scopedActorContext));
  builder
    .bind(DOMAIN_EVENTS)
    .toFactory(either(options.domainEvents, () => new InMemoryDomainEventDispatcher()));
  builder.bind(LOGGER).toFactory(either(options.logger, () => new NoopLogger()));
  builder.bind(METRICS).toFactory(either(options.metrics, () => new NoopMetrics()));
  builder.bind(CACHE).toFactory(either(options.cache, (resolve) => new InMemoryCache(resolve(CLOCK))));
  builder.bind(LOCK).toFactory(either(options.lock, (resolve) => new InMemoryLock(resolve(CLOCK))));
  builder
    .bind(RATE_LIMITER)
    .toFactory(either(options.rateLimiter, (resolve) => new InMemoryRateLimiter(resolve(CLOCK))));
  builder.bind(JOB_SCHEDULER).toFactory(either(options.jobScheduler, inProcessJobScheduler));
}

/**
 * The lock is resolved at each occurrence, not when the scheduler is built: the application
 * resolves the scheduler at creation to register the jobs, and that must not open a connection.
 */
function inProcessJobScheduler(resolve: Resolve): JobScheduler {
  return new InProcessJobScheduler({
    clock: resolve(CLOCK),
    lock: { acquire: (key, options) => resolve(LOCK).acquire(key, options) },
    scope: resolve(EXECUTION_SCOPE),
    ids: resolve(ID_GENERATOR),
    logger: resolve(LOGGER),
    metrics: resolve(METRICS),
  });
}

function scopedActorContext(resolve: Resolve): ActorContext {
  return new ScopedActorContext(resolve(EXECUTION_SCOPE), resolve(ID_GENERATOR));
}

function either<T>(provided: Provided<T> | undefined, fallback: (resolve: Resolve) => T): (resolve: Resolve) => T {
  if (provided === undefined) return fallback;
  return isFactory(provided) ? provided : () => provided;
}

function isFactory<T>(provided: Provided<T>): provided is (resolve: Resolve) => T {
  return typeof provided === 'function';
}

/**
 * The unit of work is resolved at each command, not when the bus is built: the application
 * resolves the bus at creation to attach the handlers, and that must not open a database.
 */
export function transactionalCommandBus(resolve: Resolve): InMemoryCommandBus {
  return new InMemoryCommandBus()
    .use(useCaseGuard(resolve))
    .use(unitOfWorkMiddleware({ run: (work) => resolve(UNIT_OF_WORK).run(work) }));
}

export function guardedQueryBus(resolve: Resolve): InMemoryQueryBus {
  return new InMemoryQueryBus().use(useCaseGuard(resolve));
}
