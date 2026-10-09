import {
  AsyncLocalStorageExecutionScope,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  InMemoryQueryBus,
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
  type EventBus,
  type ExecutionScope,
  type IdGenerator,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
  type Logger,
  type Metrics,
  type ProcessedEventStore,
  type QueryBus,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { ACTOR_CONTEXT, useCaseGuard } from './authorization.js';
import {
  CACHE,
  CLOCK,
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
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
  builder.bind(LOGGER).toFactory(either(options.logger, () => new NoopLogger()));
  builder.bind(METRICS).toFactory(either(options.metrics, () => new NoopMetrics()));
  builder.bind(CACHE).toFactory(either(options.cache, (resolve) => new InMemoryCache(resolve(CLOCK))));
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
