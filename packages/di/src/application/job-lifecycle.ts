import { JobScheduler } from '@ddd-ts-kit/kernel';
import { definitionOf } from '../jobs/definition-of.js';
import type { EffectiveJob } from '../jobs/effective-job.js';
import type { Resolve } from '../wiring/resolve.js';

/** The declared jobs on the job scheduler: registered at creation, run by time while the application runs. */
export class JobLifecycle {
  private started = false;

  constructor(
    readonly jobs: readonly EffectiveJob[],
    private readonly resolve: Resolve,
    private readonly runsByTime: boolean,
  ) {}

  /** Leaves the scheduler alone, unbuilt, in an application without job. */
  register(): void {
    if (this.jobs.length === 0) return;

    const scheduler = this.resolve(JobScheduler);

    for (const job of this.jobs) scheduler.register(definitionOf(job, this.resolve));
  }

  async start(): Promise<void> {
    if (!this.runsByTime || this.jobs.length === 0 || this.started) return;

    this.started = true;
    await this.resolve(JobScheduler).start();
  }

  /** Answers what failed, for the application to go on stopping the rest. */
  async stop(): Promise<unknown[]> {
    if (!this.started) return [];

    this.started = false;

    try {
      await this.resolve(JobScheduler).stop();

      return [];
    } catch (error) {
      return [error];
    }
  }
}
