import type { BackgroundJobRun, InMemoryJobStore, QueueWorker } from '@ddd-ts-kit/scheduling';

export interface TestBackgroundJobs {
  /**
   * Runs every background job due on `clock`, as the worker would (execution scope of origin
   * `queue`, as the actor that enqueued it), until none is left, and answers the attempts.
   * Unlike the worker, it throws what an attempt threw: a spec wants the failure, not its code.
   * A job enqueued with a delay is due once `clock.advance` passed it.
   */
  runDue(): Promise<BackgroundJobRun[]>;

  /** `store.list()` shows what was enqueued, with its status and progress. */
  readonly store: InMemoryJobStore;

  /** On `clock` and timers that never fire by themselves: for a spec about the worker itself. */
  readonly worker: QueueWorker;
}
