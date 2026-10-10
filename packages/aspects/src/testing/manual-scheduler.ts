import type { FixedClock } from '@ddd-ts-kit/kernel';
import type { Scheduler } from '../runtime/scheduler.js';

interface ScheduledWork {
  readonly dueAt: number;
  readonly work: () => void;
}

/** Time that only moves when a test says so: `advance(ms)` runs what became due, in order. */
export class ManualScheduler implements Scheduler {
  private elapsed = 0;

  private scheduled: ScheduledWork[] = [];

  constructor(private readonly clock?: FixedClock) {}

  /** Work scheduled and neither run nor cancelled. */
  get pending(): number {
    return this.scheduled.length;
  }

  schedule(work: () => void, delayMs: number): () => void {
    const scheduled = { dueAt: this.elapsed + delayMs, work };

    this.scheduled.push(scheduled);

    return () => {
      this.scheduled = this.scheduled.filter((other) => other !== scheduled);
    };
  }

  advance(durationMs: number): void {
    this.elapsed += durationMs;
    this.clock?.advance(durationMs);

    const due = this.scheduled.filter((scheduled) => scheduled.dueAt <= this.elapsed);

    this.scheduled = this.scheduled.filter((scheduled) => scheduled.dueAt > this.elapsed);

    for (const { work } of due.sort((first, second) => first.dueAt - second.dueAt)) {
      work();
    }
  }
}
