import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryDomainEventDispatcher,
  reportAfterCommitFailures,
  InMemoryErrorReporter,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryRateLimiter,
  SequentialIdGenerator,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { reportFailedRuns } from '@ddd-ts-kit/scheduling';
import { ManualJobScheduler, type ManualJobSchedulerOptions } from '@ddd-ts-kit/scheduling/testing';
import { guardedQueryBus } from '../kernel/guarded-query-bus.js';
import { transactionalCommandBus } from '../kernel/transactional-command-bus.js';
import type { Resolve } from '../wiring/resolve.js';
import type { TestApplicationOptions } from './test-application-options.js';
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

  const afterCommitFailed = reportAfterCommitFailures({
    reporter: errors,
    logger: observability.logger,
    scope: executionScope,
  });

  const scheduler = manualScheduler({ clock, scope: executionScope, ...observability }, errors);

  return {
    commandBus: transactionalCommandBus(resolve),
    queryBus: guardedQueryBus(resolve),
    eventBus: new InMemoryEventBus(),
    domainEvents: new InMemoryDomainEventDispatcher(afterCommitFailed),
    clock,
    ids: new SequentialIdGenerator(options.idPrefix),
    actorContext,
    executionScope,
    ...observability,
    errors,
    cache: new InMemoryCache(clock),
    rateLimiter: new InMemoryRateLimiter(clock),
    jobs: testJobs(scheduler),
  };
}

function defaultExecutionContext({ session, actor }: TestApplicationOptions): ExecutionContext {
  return executionContext({
    correlationId: 'test-correlation',
    actor: session?.actor ?? actor ?? DEFAULT_ACTOR,
    origin: 'test',
    ...(session === undefined ? {} : { session }),
  });
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
