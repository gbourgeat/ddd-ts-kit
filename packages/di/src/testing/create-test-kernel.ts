import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryCacheInvalidation,
  InMemoryDomainEventDispatcher,
  reportAfterCommitFailures,
  InMemoryErrorReporter,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryProcessStore,
  InMemoryRateLimiter,
  InMemoryTenantDirectory,
  SequentialIdGenerator,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryJobStore,
  QueueWorker,
  StoredJobQueue,
  reportFailedBackgroundJobs,
  reportFailedRuns,
  type BackgroundJobRun,
} from '@ddd-ts-kit/scheduling';
import { ManualJobScheduler, ManualJobTimers, type ManualJobSchedulerOptions } from '@ddd-ts-kit/scheduling/testing';
import { guardedQueryBus } from '../kernel/guarded-query-bus.js';
import { transactionalCommandBus } from '../kernel/transactional-command-bus.js';
import type { Resolve } from '../wiring/resolve.js';
import type { TestApplicationOptions } from './test-application-options.js';
import type { TestBackgroundJobs } from './test-background-jobs.js';
import type { TestJobs } from './test-jobs.js';
import type { TestKernel } from './test-kernel.js';

const DEFAULT_NOW = new Date('2026-01-01T00:00:00.000Z');
const DEFAULT_ACTOR: Actor = { id: 'test-user', type: 'user', roles: [], attributes: {} };

/** The deterministic stand-ins of the kernel ports, which a spec reads and moves. */
export function createTestKernel(options: TestApplicationOptions, resolve: Resolve): TestKernel {
  const clock = new FixedClock(options.now ?? DEFAULT_NOW);
  const context = options.executionContext ?? defaultExecutionContext(options);
  const actorContext = new FixedActorContext(context.actor);
  const executionScope = new FixedExecutionScope(context, actorContext);
  const observability = { logger: new InMemoryLogger(), metrics: new InMemoryMetrics(), lock: new InMemoryLock(clock) };
  const errors = new InMemoryErrorReporter();
  const tenants = new InMemoryTenantDirectory(options.tenants ?? tenantsOf(context));
  const scheduler = manualScheduler({ clock, scope: executionScope, tenants, ...observability }, errors);

  return {
    commandBus: transactionalCommandBus(resolve),
    queryBus: guardedQueryBus(resolve),
    eventBus: new InMemoryEventBus({ failures: options.eventBusFailures }),
    domainEvents: domainEventsReportedTo(errors, observability.logger, executionScope),
    clock,
    ids: new SequentialIdGenerator(options.idPrefix),
    actorContext,
    executionScope,
    ...observability,
    errors,
    cache: new InMemoryCache(clock),
    cacheInvalidation: new InMemoryCacheInvalidation(),
    rateLimiter: new InMemoryRateLimiter(clock),
    jobs: testJobs(scheduler),
    ...testQueue({ clock, scope: executionScope, ...observability }, errors),
    processes: new InMemoryProcessStore(),
  };
}

/** A failure after the commit is reported to the reporter the spec reads, and logged. */
function domainEventsReportedTo(
  reporter: InMemoryErrorReporter,
  logger: InMemoryLogger,
  scope: FixedExecutionScope,
): InMemoryDomainEventDispatcher {
  return new InMemoryDomainEventDispatcher(reportAfterCommitFailures({ reporter, logger, scope }));
}

function defaultExecutionContext({ session, actor }: TestApplicationOptions): ExecutionContext {
  return executionContext({
    correlationId: 'test-correlation',
    actor: session?.actor ?? actor ?? DEFAULT_ACTOR,
    origin: 'test',
    ...(session === undefined ? {} : { session }),
  });
}

/** The tenant of the work a spec runs as: what a per-tenant job runs for unless the spec names others. */
function tenantsOf(context: ExecutionContext): readonly string[] {
  return context.tenantId === undefined ? [] : [context.tenantId];
}

type SchedulerParts = Omit<ManualJobSchedulerOptions, 'ids' | 'onRun'>;

function manualScheduler(parts: SchedulerParts, errors: InMemoryErrorReporter): ManualJobScheduler {
  return new ManualJobScheduler({
    ...parts,
    ids: new SequentialIdGenerator('job-run'),
    onRun: reportFailedRuns(errors),
  });
}

function testJobs(scheduler: ManualJobScheduler): TestJobs {
  return {
    scheduler,
    async runNow(name) {
      const run = await scheduler.runNow(name);

      if (run.outcome === 'failed') {
        throw scheduler.failures.at(-1);
      }

      return run;
    },
  };
}

type QueueParts = Pick<TestKernel, 'clock' | 'logger' | 'metrics'> & { readonly scope: FixedExecutionScope };

/** The queue and its worker in memory, on the clock of the spec. */
function testQueue(parts: QueueParts, errors: InMemoryErrorReporter): Pick<TestKernel, 'jobQueue' | 'backgroundJobs'> {
  const { clock, scope, logger, metrics } = parts;
  const store = new InMemoryJobStore();
  const failures = new Map<BackgroundJobRun, unknown>();
  const report = reportFailedBackgroundJobs(errors);

  const worker = new QueueWorker({
    store,
    clock,
    scope,
    logger,
    metrics,
    timers: new ManualJobTimers(clock),
    onRun: (run, error) => {
      report(run, error);
      failures.set(run, error);
    },
  });

  const jobQueue = new StoredJobQueue({ store, clock, scope, ids: new SequentialIdGenerator('job') });

  return { jobQueue, backgroundJobs: testBackgroundJobs(store, worker, failures) };
}

function testBackgroundJobs(
  store: InMemoryJobStore,
  worker: QueueWorker,
  failures: Map<BackgroundJobRun, unknown>,
): TestBackgroundJobs {
  return {
    store,
    worker,
    async runDue() {
      const runs = await worker.runDue();
      const failed = runs.find((run) => run.outcome === 'retried' || run.outcome === 'dead');

      if (failed !== undefined) {
        throw failures.get(failed);
      }

      return runs;
    },
  };
}
