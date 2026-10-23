import {
  ActorContext,
  AsyncLocalStorageExecutionScope,
  Cache,
  CacheInvalidation,
  Clock,
  CommandBus,
  DomainEventDispatcher,
  ErrorReporter,
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
  InMemoryProcessStore,
  JobQueue,
  JobScheduler,
  Lock,
  Logger,
  Metrics,
  NoopErrorReporter,
  NoopLogger,
  NoopMetrics,
  ProcessRunner,
  ProcessStore,
  PublishedCacheInvalidation,
  ProcessedEventStore,
  QueryBus,
  RateLimiter,
  ScopedActorContext,
  SystemClock,
  TenantDirectory,
  UnitOfWork,
  UuidGenerator,
  dispatchingOnSave,
  reportAfterCommitFailures,
  type DependencyKind,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryJobStore,
  InProcessJobScheduler,
  JobStore,
  QueueWorker,
  StoredJobQueue,
  StoredProcessRunner,
  reportFailedBackgroundJobs,
  reportFailedRuns,
} from '@ddd-ts-kit/scheduling';
import type { ContextModule } from '../module/context-module';
import { defineContextModule } from '../module/define-context-module';
import type { ModuleBuilder } from '../module/module-builder';
import type { Resolve } from '../wiring/resolve';
import { guardedQueryBus } from './guarded-query-bus';
import { Instrumentation } from './instrumentation';
import type { KernelModuleOptions } from './kernel-module-options';
import { lazyErrorReporter } from './lazy-error-reporter';
import { lazyJobStore } from './lazy-job-store';
import type { Provided } from './provided';
import { transactionalCommandBus } from './transactional-command-bus';

const EVERY_KIND: readonly DependencyKind[] = [
  'repository',
  'gateway',
  'external',
  'use-case',
  'publisher',
  'consumer',
  'domain-event-handler',
  'job',
];

/**
 * Binds the ports of the kernel to in-process defaults: system clock, UUIDs, in-memory buses, a
 * command bus running every command in the unit of work, both buses asking the use case guard
 * first and handing their unexpected failures to the error reporter. Replace one through the options, or from a later module with `builder.rebind(Clock)`.
 *
 * Every binding of kind `repository`, in every module, hands over the domain events of the
 * aggregates it is given once the call resolved (`dispatchingOnSave`): handlers only save, and
 * the unit of work of the command dispatches them at its end, before the commit. A failure of
 * an `after-commit` handler goes to the `Logger` and the `ErrorReporter`.
 */
export function kernelModule(options: KernelModuleOptions = {}): ContextModule {
  const instrumentation = options.instrumentation ?? {};

  return defineContextModule({
    name: 'kernel',
    register(builder) {
      builder.bind(Instrumentation).toValue(instrumentation);
      builder.bind(Clock).toFactory(either(options.clock, () => new SystemClock()));
      builder.bind(IdGenerator).toFactory(either(options.ids, () => new UuidGenerator()));
      builder.bind(UnitOfWork).toFactory(either(options.unitOfWork, () => new InMemoryUnitOfWork()));
      bindBuses(builder, options);
      bindEventPorts(builder, options);
      bindCrossCuttingPorts(builder, options);
      wrapBindings(builder, instrumentation);
    },
  });
}

function bindBuses(builder: ModuleBuilder, { commandBus, queryBus, instrumentation }: KernelModuleOptions): void {
  const observed = instrumentation?.useCase;

  builder.bind(CommandBus).toFactory(either(commandBus, (resolve) => transactionalCommandBus(resolve, observed)));
  builder.bind(QueryBus).toFactory(either(queryBus, (resolve) => guardedQueryBus(resolve, observed)));
}

/** Declared in this order: what observes a binding is outside the dispatch, so it sees the save and what the save announced. */
function wrapBindings(builder: ModuleBuilder, { binding }: Instrumentation): void {
  if (binding !== undefined) {
    builder.around(EVERY_KIND, () => binding);
  }

  builder.around(
    ['repository'],
    (resolve) => (repository) => dispatchingOnSave(repository, () => resolve(DomainEventDispatcher)),
  );
}

function either<T>(provided: Provided<T> | undefined, fallback: (resolve: Resolve) => T): (resolve: Resolve) => T {
  if (provided === undefined) {
    return fallback;
  }

  return isFactory(provided) ? provided : () => provided;
}

function isFactory<T>(provided: Provided<T>): provided is (resolve: Resolve) => T {
  return typeof provided === 'function';
}

function bindEventPorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  builder
    .bind(EventBus)
    .toFactory(either(options.eventBus, () => new InMemoryEventBus({ failures: options.eventBusFailures })));

  builder.bind(IntegrationEventPublisher).toFactory(
    wrapped(
      either(options.eventPublisher, (resolve) => resolve(EventBus)),
      options.instrumentation?.publisher,
    ),
  );

  builder.bind(IntegrationEventSubscriber).toFactory(either(options.eventSubscriber, (resolve) => resolve(EventBus)));
  builder.bind(EventSubscribers).toFactory(either(options.eventSubscribers, oneSubscriberForAll));

  builder.bind(ProcessedEventStore).toFactory(either(options.processedEvents, () => new InMemoryProcessedEventStore()));
}

/** The port as the options or the default give it, inside what the instrumentation puts around it. */
function wrapped<T>(build: (resolve: Resolve) => T, wrap: ((port: T) => T) | undefined): (resolve: Resolve) => T {
  return wrap === undefined ? build : (resolve) => wrap(build(resolve));
}

function oneSubscriberForAll(resolve: Resolve): EventSubscribers {
  return { forContext: () => resolve(IntegrationEventSubscriber) };
}

function bindCrossCuttingPorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  const { instrumentation = {} } = options;

  builder.bind(ExecutionScope).toFactory(
    wrapped(
      either(options.executionScope, () => new AsyncLocalStorageExecutionScope()),
      told(instrumentation),
    ),
  );

  builder.bind(ActorContext).toFactory(either(options.actorContext, scopedActorContext));

  builder
    .bind(DomainEventDispatcher)
    .toFactory(wrapped(either(options.domainEvents, inProcessDomainEvents), instrumentation.domainEvents));

  builder.bind(Logger).toFactory(either(options.logger, () => new NoopLogger()));
  builder.bind(Metrics).toFactory(either(options.metrics, () => new NoopMetrics()));

  builder.bind(ErrorReporter).toFactory(
    wrapped(
      either(options.errorReporter, () => new NoopErrorReporter()),
      instrumentation.errorReporter,
    ),
  );

  builder.bind(Cache).toFactory(either(options.cache, (resolve) => new InMemoryCache(resolve(Clock))));
  builder.bind(CacheInvalidation).toFactory(either(options.cacheInvalidation, publishedCacheInvalidation));
  builder.bind(Lock).toFactory(either(options.lock, (resolve) => new InMemoryLock(resolve(Clock))));

  builder
    .bind(RateLimiter)
    .toFactory(either(options.rateLimiter, (resolve) => new InMemoryRateLimiter(resolve(Clock))));

  bindJobs(builder, options);
  bindQueuePorts(builder, options);
}

/** The scheduler, and the tenants a job declared `per-tenant` runs for when the options name them. */
function bindJobs(builder: ModuleBuilder, { jobScheduler, tenants }: KernelModuleOptions): void {
  if (tenants !== undefined) {
    builder.bind(TenantDirectory).toFactory(isFactory(tenants) ? tenants : () => tenants);
  }

  builder
    .bind(JobScheduler)
    .toFactory(either(jobScheduler, (resolve) => inProcessJobScheduler(resolve, tenants !== undefined)));
}

function bindQueuePorts(builder: ModuleBuilder, options: KernelModuleOptions): void {
  const { traceparent } = options.instrumentation ?? {};

  builder.bind(JobStore).toFactory(either(options.jobStore, () => new InMemoryJobStore()));

  builder.bind(JobQueue).toFactory(
    either(
      options.jobQueue,
      (resolve) =>
        new StoredJobQueue({
          store: resolve(JobStore),
          clock: resolve(Clock),
          ids: resolve(IdGenerator),
          scope: resolve(ExecutionScope),
          ...(traceparent === undefined ? {} : { traceparent }),
        }),
    ),
  );

  builder.bind(QueueWorker).toFactory(either(options.queueWorker, (resolve) => queueWorker(resolve, options)));
  builder.bind(ProcessStore).toFactory(either(options.processStore, () => new InMemoryProcessStore()));

  builder.bind(ProcessRunner).toFactory(
    (resolve) =>
      new StoredProcessRunner({
        store: resolve(ProcessStore),
        jobs: resolve(JobQueue),
        commands: resolve(CommandBus),
        unitOfWork: resolve(UnitOfWork),
      }),
  );
}

/** Like the scheduler, the store is resolved when the worker first claims, not when the application registers the jobs. */
function queueWorker(resolve: Resolve, { queues = {} }: KernelModuleOptions): QueueWorker {
  return new QueueWorker({
    ...queues,
    store: lazyJobStore(resolve),
    clock: resolve(Clock),
    scope: resolve(ExecutionScope),
    logger: resolve(Logger),
    metrics: resolve(Metrics),
    onRun: reportFailedBackgroundJobs(lazyErrorReporter(resolve)),
  });
}

/** A purge request rides on the publisher of the application: with an outbox, it commits with the work. */
function publishedCacheInvalidation(resolve: Resolve): CacheInvalidation {
  return new PublishedCacheInvalidation({
    publisher: resolve(IntegrationEventPublisher),
    ids: resolve(IdGenerator),
    clock: resolve(Clock),
    scope: resolve(ExecutionScope),
  });
}

/** The logger, the reporter and the scope are resolved at each failure: a later module or a test may replace them. */
function inProcessDomainEvents(resolve: Resolve): DomainEventDispatcher {
  const failed = reportAfterCommitFailures({
    reporter: lazyErrorReporter(resolve),
    logger: { error: (message, fields) => resolve(Logger).error(message, fields) },
    scope: { current: () => resolve(ExecutionScope).current() },
  });

  return new InMemoryDomainEventDispatcher(failed);
}

function told({ executionScope }: Instrumentation): ((scope: ExecutionScope) => ExecutionScope) | undefined {
  if (executionScope === undefined) {
    return undefined;
  }

  return (scope) => {
    executionScope(scope);

    return scope;
  };
}

function scopedActorContext(resolve: Resolve): ActorContext {
  return new ScopedActorContext(resolve(ExecutionScope), resolve(IdGenerator));
}

/**
 * The lock, the error reporter and the tenants are resolved when they are needed, not when the scheduler is
 * built: the application resolves the scheduler at creation to register the jobs, and that must
 * not open a connection.
 */
function inProcessJobScheduler(resolve: Resolve, perTenant: boolean): JobScheduler {
  return new InProcessJobScheduler({
    clock: resolve(Clock),
    lock: { acquire: (key, options) => resolve(Lock).acquire(key, options) },
    scope: resolve(ExecutionScope),
    ids: resolve(IdGenerator),
    logger: resolve(Logger),
    metrics: resolve(Metrics),
    onRun: reportFailedRuns(lazyErrorReporter(resolve)),
    ...(perTenant ? { tenants: { tenants: () => resolve(TenantDirectory).tenants() } } : {}),
  });
}
