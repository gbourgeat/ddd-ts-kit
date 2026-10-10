import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  SequentialIdGenerator,
  type JobExecution,
  type Lock,
} from '@ddd-ts-kit/kernel';
import type { JobCheckpoints } from '../src/index.js';
import { ManualJobScheduler, type ManualJobSchedulerOptions } from '../src/testing.js';

export const MINUTE = 60_000;
export const HOUR = 3_600_000;

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
  const scheduler = new ManualJobScheduler({ lock, scope, ids: new SequentialIdGenerator('run'), logger, metrics, ...options, clock });
  return { scheduler, clock, lock, scope, logger, metrics };
}

/** A job that remembers its executions and, when gated, stays in progress until the test opens the gate. */
export class RecordingJob {
  readonly executions: JobExecution[] = [];
  #open: (() => void) | undefined;
  #gate: Promise<void> | undefined;

  readonly run = async (execution: JobExecution): Promise<void> => {
    this.executions.push(execution);
    await this.#gate;
  };

  get scheduledAt(): string[] {
    return this.executions.map((execution) => execution.scheduledAt.toISOString());
  }

  gate(): void {
    this.#gate = new Promise((resolve) => {
      this.#open = resolve;
    });
  }

  open(): void {
    this.#open?.();
    this.#gate = undefined;
  }
}

export class InMemoryJobCheckpoints implements JobCheckpoints {
  readonly handled = new Map<string, Date>();

  async read(job: string): Promise<Date | undefined> {
    return this.handled.get(job);
  }

  async write(job: string, handled: Date): Promise<void> {
    this.handled.set(job, handled);
  }
}
