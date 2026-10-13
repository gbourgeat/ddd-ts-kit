import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryLogger,
  InMemoryMetrics,
  SequentialIdGenerator,
} from '@ddd-ts-kit/kernel';
import { QueueWorker, StoredJobQueue, type BackgroundJobRun, type QueueWorkerOptions } from '../../src/index.js';
import { ManualJobTimers } from '../../src/testing.js';
import { UnreliableJobStore } from './unreliable-job-store.js';

export interface QueueBench {
  readonly clock: FixedClock;
  readonly timers: ManualJobTimers;
  readonly store: UnreliableJobStore;
  readonly scope: AsyncLocalStorageExecutionScope;
  readonly logger: InMemoryLogger;
  readonly metrics: InMemoryMetrics;
  readonly queue: StoredJobQueue;
  readonly worker: QueueWorker;
  /** Every attempt the worker recorded, with what it threw. */
  readonly runs: { readonly run: BackgroundJobRun; readonly error: unknown }[];
}

type BenchOptions = Partial<Pick<QueueWorkerOptions, 'concurrency' | 'graceMs' | 'pollIntervalMs'>> & {
  readonly traceparent?: () => string | undefined;
  readonly logger?: InMemoryLogger;
};

/** A worker and a queue on one in-memory store, at 2026-03-02T10:00:00Z, time moved by the test. */
export function aQueueBench(options: BenchOptions = {}): QueueBench {
  const clock = new FixedClock(new Date('2026-03-02T10:00:00.000Z'));
  const timers = new ManualJobTimers(clock);
  const store = new UnreliableJobStore();
  const scope = new AsyncLocalStorageExecutionScope();
  const logger = options.logger ?? new InMemoryLogger();
  const metrics = new InMemoryMetrics();
  const runs: { run: BackgroundJobRun; error: unknown }[] = [];
  const { traceparent, logger: _logger, ...tuning } = options;
  const ids = new SequentialIdGenerator('job');

  const queue = new StoredJobQueue({ store, clock, ids, scope, ...(traceparent === undefined ? {} : { traceparent }) });

  const worker = new QueueWorker({
    store,
    clock,
    scope,
    timers,
    logger,
    metrics,
    ...tuning,
    onRun: (run, error) => runs.push({ run, error }),
  });

  return { clock, timers, store, scope, logger, metrics, queue, worker, runs };
}
