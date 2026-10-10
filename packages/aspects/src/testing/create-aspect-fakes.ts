import { FixedClock, InMemoryCache, InMemoryLogger, InMemoryMetrics } from '@ddd-ts-kit/kernel';
import { ManualScheduler } from './manual-scheduler.js';

export interface AspectFakes {
  readonly logger: InMemoryLogger;
  readonly metrics: InMemoryMetrics;
  readonly cache: InMemoryCache;
  readonly clock: FixedClock;
  /** Advancing it advances the clock too. */
  readonly scheduler: ManualScheduler;
}

const DEFAULT_NOW = new Date('2026-01-01T00:00:00.000Z');

/** The in-memory fakes of the kernel, on one clock, ready for `withAspectRuntime`. */
export function createAspectFakes(now: Date = DEFAULT_NOW): AspectFakes {
  const clock = new FixedClock(now);

  return {
    logger: new InMemoryLogger(),
    metrics: new InMemoryMetrics(),
    cache: new InMemoryCache(clock),
    clock,
    scheduler: new ManualScheduler(clock),
  };
}
