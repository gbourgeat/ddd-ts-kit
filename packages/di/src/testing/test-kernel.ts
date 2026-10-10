import type {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryErrorReporter,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryQueryBus,
  InMemoryRateLimiter,
  SequentialIdGenerator,
} from '@ddd-ts-kit/kernel';
import type { TestJobs } from './test-jobs.js';

export interface TestKernel {
  readonly commandBus: InMemoryCommandBus;
  readonly queryBus: InMemoryQueryBus;
  /** Publisher and subscriber at once; `published` lists what the use cases announced. */
  readonly eventBus: InMemoryEventBus;
  /**
   * Where a spec dispatches a domain event to see the declared handlers of the context react:
   * `dispatch([event])` for the `before-commit` ones, `dispatch([event], 'after-commit')` for the
   * others. What an `after-commit` handler threw is in `domainEvents.afterCommitFailures`, in
   * `errors.reports` and in `logger.entries`.
   */
  readonly domainEvents: InMemoryDomainEventDispatcher;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
  /** Change the current actor with `actorContext.actAs(actor)` or `actorContext.run(actor, work)`. */
  readonly actorContext: FixedActorContext;
  /**
   * The execution context infrastructure sees: correlation `test-correlation`, origin `test`.
   * It follows `actorContext`; replace it with `executionScope.enter(context)`.
   */
  readonly executionScope: FixedExecutionScope;
  /** `logger.entries` lists what was logged, errors as their description. */
  readonly logger: InMemoryLogger;
  /** `metrics.samples` lists what was measured. */
  readonly metrics: InMemoryMetrics;
  /** `errors.reports` lists the unexpected failures the buses and the jobs reported. */
  readonly errors: InMemoryErrorReporter;
  /** Expires by `clock`. */
  readonly cache: InMemoryCache;
  /** Frees a key by `clock`; a wait for a held key really waits. */
  readonly lock: InMemoryLock;
  /** Counts by `clock`. */
  readonly rateLimiter: InMemoryRateLimiter;
  /** The declared jobs, which no time starts: a spec runs one, then asserts its fakes. */
  readonly jobs: TestJobs;
}
