import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  SequentialIdGenerator,
  type Lock,
} from '@ddd-ts-kit/kernel';
import { ManualJobScheduler, type ManualJobSchedulerOptions } from '../../src/testing';

export interface Bench {
  readonly scheduler: ManualJobScheduler;
  readonly clock: FixedClock;
  readonly lock: Lock;
  readonly scope: AsyncLocalStorageExecutionScope;
  readonly logger: InMemoryLogger;
  readonly metrics: InMemoryMetrics;
}

type BenchOptions = Partial<Omit<ManualJobSchedulerOptions, 'clock'>> & { readonly clock?: FixedClock };

/** A manual scheduler with every collaborator in memory, at 2026-03-02T09:58:30Z (a Monday) unless told otherwise. */
export function aBench(options: BenchOptions = {}): Bench {
  const clock = options.clock ?? new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
  const lock = options.lock ?? new InMemoryLock(clock);
  const scope = new AsyncLocalStorageExecutionScope();
  const logger = new InMemoryLogger();
  const metrics = new InMemoryMetrics();

  const scheduler = new ManualJobScheduler({
    lock,
    scope,
    ids: new SequentialIdGenerator('run'),
    logger,
    metrics,
    ...options,
    clock,
  });

  return { scheduler, clock, lock, scope, logger, metrics };
}
