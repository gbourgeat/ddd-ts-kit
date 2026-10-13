import {
  executionContextOfBackgroundJob,
  retryDelayMs,
  type BackgroundJobExecution,
  type Clock,
  type ExecutionScope,
  type JobProgress,
} from '@ddd-ts-kit/kernel';
import { errorCodeOf } from '../errors/error-code-of.js';
import { JobAbortedError } from '../errors/job-aborted-error.js';
import { JobTimeoutError } from '../errors/job-timeout-error.js';
import type { JobTimers } from '../job-timers.js';
import { unlessAborted } from '../unless-aborted.js';
import type { BackgroundJobOutcome } from './background-job-outcome.js';
import type { BackgroundJobRecorder } from './background-job-recorder.js';
import type { BackgroundJobRun } from './background-job-run.js';
import { JobInterruptedError } from './errors/job-interrupted-error.js';
import type { RegisteredBackgroundJob } from './registered-background-job.js';
import type { RunningJob } from './running-job.js';
import type { ClaimedJob } from './store/claimed-job.js';
import type { JobStore } from './store/job-store.js';
import type { JobUpdate } from './store/job-update.js';

interface Refusal {
  readonly error: Error;
  /** False when no attempt is left. */
  readonly retry: boolean;
}

export interface ClaimedJobRunnerOptions {
  readonly store: JobStore;
  readonly clock: Clock;
  readonly scope: ExecutionScope;
  readonly timers: JobTimers;
}

/** Runs one attempt of a claimed job: the execution scope, the heartbeats, the timeout, and what the store is told. */
export class ClaimedJobRunner {
  constructor(
    private readonly options: ClaimedJobRunnerOptions,
    private readonly recorder: BackgroundJobRecorder,
  ) {}

  /** Answers what became of the attempt. Never rejects. `stopping` aborts it when the worker stops. */
  async run(job: ClaimedJob, registered: RegisteredBackgroundJob, stopping: AbortSignal): Promise<BackgroundJobRun> {
    const running = this.started(job, registered);
    const unlink = linked(stopping, running.controller, () => new JobAbortedError(job.name));
    const disarm = this.armTimeout(running);

    this.beatLater(running);

    try {
      return await this.attempt(running);
    } catch (error) {
      // The store could not be told: the lease ends and the job is claimed again.
      return this.recorded(running, 'interrupted', error);
    } finally {
      running.stopBeating();
      disarm();
      unlink();
    }
  }

  /** Settles a job this worker does not run: no attempt is left, or no module registered it. Never rejects. */
  async refuse(job: ClaimedJob, registered: RegisteredBackgroundJob, refusal: Refusal): Promise<BackgroundJobRun> {
    const running = this.started(job, registered);

    try {
      return await this.settled(running, refusal.error, refusal.retry ? this.retryAt(running) : null);
    } catch (error) {
      return this.recorded(running, 'interrupted', error);
    }
  }

  private started(job: ClaimedJob, registered: RegisteredBackgroundJob): RunningJob {
    return {
      job,
      registered,
      lease: { id: job.id, attempt: job.attempt },
      controller: new AbortController(),
      startedAt: this.options.clock.now(),
      stopBeating: nothing,
    };
  }

  private async attempt(running: RunningJob): Promise<BackgroundJobRun> {
    try {
      await unlessAborted(running.controller.signal, this.inScope(running));
    } catch (error) {
      return this.failed(running, error);
    }

    return this.succeeded(running);
  }

  private inScope(running: RunningJob): Promise<void> {
    const { job, registered, controller, startedAt } = running;
    const { timeoutMs } = registered.policy;
    const deadline = timeoutMs === undefined ? undefined : new Date(startedAt.getTime() + timeoutMs);
    const { traceparent } = job.enqueuedBy;

    const context = executionContextOfBackgroundJob({
      jobId: job.id,
      enqueuedBy: job.enqueuedBy,
      ...(deadline === undefined ? {} : { deadline }),
    });

    const execution: BackgroundJobExecution = {
      jobId: job.id,
      attempt: job.attempt,
      enqueuedAt: job.enqueuedAt,
      startedAt,
      checkpoint: job.checkpoint,
      signal: controller.signal,
      ...(traceparent === undefined ? {} : { traceparent }),
      saveCheckpoint: (checkpoint: unknown) => this.write(running, { checkpoint }),
      reportProgress: (progress: JobProgress) => this.write(running, { progress }),
    };

    return this.options.scope.run(context, () => registered.definition.run(job.payload, execution));
  }

  private async write(running: RunningJob, update: JobUpdate): Promise<void> {
    const held = await this.options.store.update(running.lease, update, this.leaseEnd(running));

    if (!held) {
      const interrupted = new JobInterruptedError(running.job.name);

      running.controller.abort(interrupted);

      throw interrupted;
    }
  }

  private beatLater(running: RunningJob): void {
    const every = Math.max(1, Math.floor(running.registered.policy.leaseMs / 3));

    running.stopBeating = this.options.timers.schedule(every, () => {
      void this.beat(running);
    });
  }

  /** A heartbeat the store cannot take keeps the run going: if the lease ends, the report of the run is refused. */
  private async beat(running: RunningJob): Promise<void> {
    const held = await this.options.store.heartbeat(running.lease, this.leaseEnd(running)).catch(() => true);

    if (held) {
      this.beatLater(running);
    } else {
      running.controller.abort(new JobInterruptedError(running.job.name));
    }
  }

  private armTimeout({ registered, controller, job }: RunningJob): () => void {
    const { timeoutMs } = registered.policy;

    if (timeoutMs === undefined) {
      return nothing;
    }

    return this.options.timers.schedule(timeoutMs, () => {
      controller.abort(new JobTimeoutError(job.name, timeoutMs));
    });
  }

  private async succeeded(running: RunningJob): Promise<BackgroundJobRun> {
    const held = await this.options.store.complete(running.lease, this.options.clock.now());

    return this.recorded(running, held ? 'succeeded' : 'interrupted');
  }

  private async failed(running: RunningJob, error: unknown): Promise<BackgroundJobRun> {
    if (error instanceof JobInterruptedError) {
      return this.recorded(running, 'interrupted', error);
    }

    if (error instanceof JobAbortedError) {
      const released = await this.options.store.release(running.lease, this.options.clock.now());

      return this.recorded(running, released ? 'released' : 'interrupted', error);
    }

    return this.settled(running, error, this.retryAt(running));
  }

  private async settled(running: RunningJob, error: unknown, retryAt: Date | null): Promise<BackgroundJobRun> {
    const failure = { errorCode: errorCodeOf(error), retryAt, at: this.options.clock.now() };
    const held = await this.options.store.fail(running.lease, failure);
    const outcome: BackgroundJobOutcome = !held ? 'interrupted' : retryAt === null ? 'dead' : 'retried';

    return this.recorded(running, outcome, error);
  }

  private retryAt({ job, registered }: Pick<RunningJob, 'job' | 'registered'>): Date | null {
    if (job.attempt >= registered.policy.maxAttempts) {
      return null;
    }

    return new Date(this.options.clock.now().getTime() + retryDelayMs(registered.policy, job.attempt));
  }

  private leaseEnd(running: RunningJob): Date {
    return new Date(this.options.clock.now().getTime() + running.registered.policy.leaseMs);
  }

  private recorded(running: RunningJob, outcome: BackgroundJobOutcome, error?: unknown): BackgroundJobRun {
    const { job, startedAt } = running;
    const durationMs = this.options.clock.now().getTime() - startedAt.getTime();

    const run: BackgroundJobRun = {
      job: job.name,
      jobId: job.id,
      attempt: job.attempt,
      outcome,
      startedAt,
      durationMs,
      correlationId: job.enqueuedBy.correlationId,
      ...(error === undefined ? {} : { errorCode: errorCodeOf(error) }),
    };

    return this.recorder.record(run, error);
  }
}

function nothing(): void {
  return undefined;
}

/** Aborts `controller` when `signal` is, with the reason `reason` gives. Answers how to stop listening. */
function linked(signal: AbortSignal, controller: AbortController, reason: () => Error): () => void {
  const abort = () => {
    controller.abort(reason());
  };

  signal.addEventListener('abort', abort, { once: true });

  return () => {
    signal.removeEventListener('abort', abort);
  };
}
