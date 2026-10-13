import { InMemoryJobStore, JobStore, QueueWorker, type BackgroundJobDefinition } from '@ddd-ts-kit/scheduling';
import { Instrumentation } from '../kernel/instrumentation.js';
import type { BackgroundJobRegistration } from '../wiring/background-job-registration.js';
import type { BoundPorts } from './bound-ports.js';

/**
 * The declared background jobs on the queue worker: registered at creation, consumed while the
 * application runs in a process that runs the jobs. The worker consumes the queues of the
 * contexts whose modules it is given, and no other. A queue kept in the memory of the process
 * is seen by no other process: this one consumes it even with its jobs off, so that the jobs the
 * API enqueues next to a worker still run.
 */
export class BackgroundJobLifecycle {
  private started = false;

  constructor(
    readonly jobs: readonly BackgroundJobRegistration[],
    private readonly ports: BoundPorts,
    private readonly consumes: boolean,
  ) {}

  /** Leaves the worker alone, unbuilt, in an application without background job. */
  register(): void {
    if (this.jobs.length === 0) {
      return;
    }

    const worker = this.ports.resolve(QueueWorker);

    for (const job of this.jobs) {
      worker.register(this.definitionOf(job));
    }
  }

  async start(): Promise<void> {
    if (this.jobs.length === 0 || this.started || !(this.consumes || this.keptInMemory())) {
      return;
    }

    this.started = true;
    await this.ports.resolve(QueueWorker).start();
  }

  /** Answers what failed, for the application to go on stopping the rest. */
  async stop(): Promise<unknown[]> {
    if (!this.started) {
      return [];
    }

    this.started = false;

    try {
      await this.ports.resolve(QueueWorker).stop();

      return [];
    } catch (error) {
      return [error];
    }
  }

  private keptInMemory(): boolean {
    return this.ports.isBound(JobStore) && this.ports.resolve(JobStore) instanceof InMemoryJobStore;
  }

  /** The job is built on its first attempt, so a job that cannot be built fails that attempt. */
  private definitionOf(job: BackgroundJobRegistration): BackgroundJobDefinition {
    const { resolve } = this.ports;
    const instrument = this.ports.isBound(Instrumentation) ? resolve(Instrumentation).backgroundJob : undefined;
    const run: BackgroundJobDefinition['run'] = async (payload, execution) => resolve(job.job).run(payload, execution);

    return {
      name: job.name,
      options: job.options,
      run: instrument === undefined ? run : instrument(run, { name: job.name, context: job.module }),
    };
  }
}
