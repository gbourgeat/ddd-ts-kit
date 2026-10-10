import type { FixedClock } from '@ddd-ts-kit/kernel';
import type { JobTimers } from '../job-timers.js';

interface Sleeping {
  readonly dueAt: number;
  readonly task: () => void;
}

/**
 * Timers that only move when a test says so, on the clock the scheduler reads: `advance(ms)`
 * fires what becomes due, in order, each at its instant.
 */
export class ManualJobTimers implements JobTimers {
  private sleeping: Sleeping[] = [];

  constructor(private readonly clock: FixedClock) {}

  /** Timers neither fired nor cancelled. */
  get pending(): number {
    return this.sleeping.length;
  }

  schedule(delayMs: number, task: () => void): () => void {
    const sleeping = { dueAt: this.clock.now().getTime() + delayMs, task };

    this.sleeping.push(sleeping);

    return () => {
      this.sleeping = this.sleeping.filter((other) => other !== sleeping);
    };
  }

  /**
   * Moves the clock forward, firing each timer at its instant and letting what it started go as
   * far as promises alone take it: a job that waits on nothing else has ended when this resolves,
   * a job blocked by the test is still running.
   */
  async advance(durationMs: number): Promise<void> {
    const target = this.clock.now().getTime() + durationMs;

    await settled();

    for (let next = this.nextDue(target); next !== undefined; next = this.nextDue(target)) {
      this.sleeping = this.sleeping.filter((other) => other !== next);
      this.moveTo(next.dueAt);
      next.task();
      await settled();
    }

    this.moveTo(target);
  }

  private nextDue(target: number): Sleeping | undefined {
    const [earliest] = this.sleeping.filter(({ dueAt }) => dueAt <= target).sort((left, right) => left.dueAt - right.dueAt);

    return earliest;
  }

  private moveTo(instant: number): void {
    this.clock.advance(Math.max(0, instant - this.clock.now().getTime()));
  }
}

/** One turn of the event loop: every promise that depends on promises alone has settled. Not a wait in time. */
function settled(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
