import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryLogger,
  type InMemoryMetrics,
  SequentialIdGenerator,
} from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { InMemoryJobStore, type JobStoreStats, QueueWorker, StoredJobQueue } from '../src';
import { ManualJobTimers } from '../src/testing';
import { aQueueBench } from './support/a-queue-bench';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';
import { CompileStatementsJob } from './support/statements-job';

refuseUnhandledRejections();

/** A store that cannot count: a worker that asked it would log a fault. */
class StoreWithoutStats extends InMemoryJobStore {
  override stats(): Promise<JobStoreStats> {
    return Promise.reject(new Error('stats asked'));
  }
}

function depthOf(metrics: InMemoryMetrics): Record<string, number | undefined> {
  const queue = { queue: 'billing' };

  return {
    waiting: metrics.gaugeValue('jobs_waiting', queue),
    running: metrics.gaugeValue('jobs_running', queue),
    dead: metrics.gaugeValue('jobs_dead', queue),
  };
}

describe('a started worker given metrics', () => {
  it('sets the depth of each queue as gauges, at most once per poll interval', async () => {
    const { queue, worker, timers, metrics } = aQueueBench({ pollIntervalMs: 5_000 });
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, { month: '2026-01', customers: [] });
    await queue.enqueue(CompileStatementsJob, { month: '2026-02', customers: [] });
    job.hold();
    await worker.start();
    expect(depthOf(metrics)).toEqual({ waiting: 1, running: 1, dead: 0 });

    job.release();
    await timers.advance(0);
    expect(job.runs).toHaveLength(2);
    expect(depthOf(metrics)).toEqual({ waiting: 1, running: 1, dead: 0 });

    await timers.advance(5_000);
    expect(depthOf(metrics)).toEqual({ waiting: 0, running: 0, dead: 0 });
    await worker.stop();
  });

  it('does not ask the store to count without them', async () => {
    const clock = new FixedClock(new Date('2026-03-02T10:00:00.000Z'));
    const timers = new ManualJobTimers(clock);
    const store = new StoreWithoutStats();
    const scope = new AsyncLocalStorageExecutionScope();
    const queue = new StoredJobQueue({ store, clock, ids: new SequentialIdGenerator('job'), scope });
    const logger = new InMemoryLogger();
    const worker = new QueueWorker({ store, clock, scope, timers, logger });
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, { month: '2026-01', customers: [] });
    await worker.start();

    expect(job.runs).toHaveLength(1);
    expect(logger.entries.filter(({ level }) => level === 'error')).toEqual([]);
    await worker.stop();
  });
});
