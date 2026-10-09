import { FixedClock, InMemoryCache, InMemoryLogger, InMemoryMetrics } from '@ddd-ts-kit/kernel';
import { runWithAspectRuntime, type AspectRuntime, type Scheduler } from './runtime.js';

/**
 * Runs the work, and everything it awaits, with these collaborators in place of the installed
 * runtime: a decorated adapter is tested without any constructor parameter for them.
 * Concurrent tests do not see each other's runtime.
 */
export function withAspectRuntime<T>(runtime: AspectRuntime, work: () => T): T {
  return runWithAspectRuntime(runtime, work);
}

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

interface ScheduledWork {
  readonly dueAt: number;
  readonly work: () => void;
}

/** Time that only moves when a test says so: `advance(ms)` runs what became due, in order. */
export class ManualScheduler implements Scheduler {
  #elapsed = 0;
  #scheduled: ScheduledWork[] = [];

  constructor(private readonly clock?: FixedClock) {}

  /** Work scheduled and neither run nor cancelled. */
  get pending(): number {
    return this.#scheduled.length;
  }

  schedule(work: () => void, delayMs: number): () => void {
    const scheduled = { dueAt: this.#elapsed + delayMs, work };
    this.#scheduled.push(scheduled);
    return () => {
      this.#scheduled = this.#scheduled.filter((other) => other !== scheduled);
    };
  }

  advance(durationMs: number): void {
    this.#elapsed += durationMs;
    this.clock?.advance(durationMs);
    const due = this.#scheduled.filter((scheduled) => scheduled.dueAt <= this.#elapsed);
    this.#scheduled = this.#scheduled.filter((scheduled) => scheduled.dueAt > this.#elapsed);
    for (const { work } of due.sort((first, second) => first.dueAt - second.dueAt)) work();
  }
}
