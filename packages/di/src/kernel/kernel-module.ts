import {
  ActorContext,
  AsyncLocalStorageExecutionScope,
  Cache,
  Clock,
  CommandBus,
  DomainEventDispatcher,
  EventBus,
  EventSubscribers,
  ExecutionScope,
  IdGenerator,
  InMemoryCache,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryProcessedEventStore,
  InMemoryRateLimiter,
  InMemoryUnitOfWork,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  JobScheduler,
  Lock,
  Logger,
  Metrics,
  NoopLogger,
  NoopMetrics,
  ProcessedEventStore,
  QueryBus,
  RateLimiter,
  ScopedActorContext,
  SystemClock,
  UnitOfWork,
  UuidGenerator,
} from '@ddd-ts-kit/kernel';
import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';
import type { ContextModule } from '../module/context-module.js';
import { defineContextModule } from '../module/define-context-module.js';
import type { ModuleBuilder } from '../module/module-builder.js';
import type { Resolve } from '../wiring/resolve.js';
import { guardedQueryBus } from './guarded-query-bus.js';
import type { KernelModuleOptions } from './kernel-module-options.js';
import type { Provided } from './provided.js';
import { transactionalCommandBus } from './transactional-command-bus.js';

/**
 * Binds the ports of the kernel to in-process defaults: system clock, UUIDs, in-memory buses, a
 * command bus running every command in the unit of work, both buses asking the use case guard
 * first. Replace one through the options, or from a later module with `builder.rebind(Clock)`.
 */
export function kernelModule(options: KernelModuleOptions = {}): ContextModule {
  return defineContextModule({
    name: 'kernel',
    register(builder) {
      builder.bind(Clock).toFactory(either(options.clock, () => new SystemClock()));
      builder.bind(IdGenerator).toFactory(either(options.ids, () => new UuidGenerator()));
      builder.bind(UnitOfWork).toFactory(either(options.unitOfWork, () => new InMemoryUnitOfWork()));
      builder.bind(CommandBus).toFactory(either(options.commandBus, transactionalCommandBus));
      builder.bind(QueryBus).toFactory(either(options.queryBus, guardedQueryBus));
      bindEventPorts(builder, options);
      bindCrossCuttingPorts(builder, options);
    },
  });
}

function either<T>(provided: Provided<T> | undefined, fallback: (resolve: Resolve) => T): (resolve: Resolve) => T {
  if (provided === undefined) return fallback;

  return isFactory(provided) ? provided : () => provided;
}

function isFactory<T>(provided: Provided<T>): provided is (resolve: Resolve) => T {
  return typeof provided === 'function';
}

function bindEventPorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  builder.bind(EventBus).toFactory(either(options.eventBus, () => new InMemoryEventBus()));
  builder.bind(IntegrationEventPublisher).toFactory(either(options.eventPublisher, (resolve) => resolve(EventBus)));
  builder.bind(IntegrationEventSubscriber).toFactory(either(options.eventSubscriber, (resolve) => resolve(EventBus)));
  builder.bind(EventSubscribers).toFactory(either(options.eventSubscribers, oneSubscriberForAll));

  builder
    .bind(ProcessedEventStore)
    .toFactory(either(options.processedEvents, () => new InMemoryProcessedEventStore()));
}

function oneSubscriberForAll(resolve: Resolve): EventSubscribers {
  return { forContext: () => resolve(IntegrationEventSubscriber) };
}

function bindCrossCuttingPorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  builder
    .bind(ExecutionScope)
    .toFactory(either(options.executionScope, () => new AsyncLocalStorageExecutionScope()));

  builder.bind(ActorContext).toFactory(either(options.actorContext, scopedActorContext));

  builder
    .bind(DomainEventDispatcher)
    .toFactory(either(options.domainEvents, () => new InMemoryDomainEventDispatcher()));

  builder.bind(Logger).toFactory(either(options.logger, () => new NoopLogger()));
  builder.bind(Metrics).toFactory(either(options.metrics, () => new NoopMetrics()));
  builder.bind(Cache).toFactory(either(options.cache, (resolve) => new InMemoryCache(resolve(Clock))));
  builder.bind(Lock).toFactory(either(options.lock, (resolve) => new InMemoryLock(resolve(Clock))));

  builder
    .bind(RateLimiter)
    .toFactory(either(options.rateLimiter, (resolve) => new InMemoryRateLimiter(resolve(Clock))));

  builder.bind(JobScheduler).toFactory(either(options.jobScheduler, inProcessJobScheduler));
}

function scopedActorContext(resolve: Resolve): ActorContext {
  return new ScopedActorContext(resolve(ExecutionScope), resolve(IdGenerator));
}

/**
 * The lock is resolved at each occurrence, not when the scheduler is built: the application
 * resolves the scheduler at creation to register the jobs, and that must not open a connection.
 */
function inProcessJobScheduler(resolve: Resolve): JobScheduler {
  return new InProcessJobScheduler({
    clock: resolve(Clock),
    lock: { acquire: (key, options) => resolve(Lock).acquire(key, options) },
    scope: resolve(ExecutionScope),
    ids: resolve(IdGenerator),
    logger: resolve(Logger),
    metrics: resolve(Metrics),
  });
}
