import { executionContextOfJob, type Clock, type ExecutionScope, type IdGenerator, type JobRun, type Lock } from '@ddd-ts-kit/kernel';
import { JobLockUnavailableError, JobTimeoutError } from './errors.js';
import type { JobRecorder, StartedRun } from './recorder.js';
import type { Occurrence, RegisteredJob } from './registered-job.js';
import type { JobTimers } from './timers.js';

export interface RunnerOptions {
  readonly clock: Clock;
  readonly lock: Lock;
  readonly scope: ExecutionScope;
  readonly ids: IdGenerator;
  readonly timers: JobTimers;
  /** How long the lock of an occurrence is kept for a job without timeout. */
  readonly lockTtlMs: number;
  /** How long after its instant another instance may still try an occurrence. */
  readonly lateAfterMs: number;
}

/** Runs one occurrence: the lock of the occurrence, the execution scope, the timeout. */
export class JobRunner {
  constructor(
    private readonly options: RunnerOptions,
    private readonly recorder: JobRecorder,
  ) {}

  /** Answers what became of the occurrence. Never rejects. */
  async run(job: RegisteredJob, occurrence: Occurrence): Promise<JobRun> {
    try {
      const held = await this.#holds(job, occurrence);
      return held ? await this.#execute(job, occurrence) : this.recorder.notRun(job, occurrence, 'skipped-locked');
    } catch (error) {
      return this.recorder.refused(job, occurrence, error);
    }
  }

  /*
   * The lock is not released when the run ends: an instance whose timer fires a little later
   * would take it and run the occurrence again. It is kept until this instance handles the next
   * occurrence of the job, or until its time to live has passed.
   */
  async #holds(job: RegisteredJob, { scheduledAt, manual }: Occurrence): Promise<boolean> {
    if (!job.policy.singleInstance || manual) return true;
    const { timeoutMs, jitterMs } = job.policy;
    const ttlMs = (timeoutMs ?? this.options.lockTtlMs) + jitterMs + this.options.lateAfterMs;
    try {
      await job.held?.release();
      job.held = await this.options.lock.acquire(`job:${job.name}:${scheduledAt.toISOString()}`, { ttlMs });
    } catch (error) {
      throw new JobLockUnavailableError(job.name, { cause: error });
    }
    return job.held !== undefined;
  }

  async #execute(job: RegisteredJob, occurrence: Occurrence): Promise<JobRun> {
    const started = { occurrence, startedAt: this.options.clock.now(), correlationId: this.options.ids.next() };
    const controller = new AbortController();
    job.abort = (reason) => {
      controller.abort(reason);
    };
    const disarm = this.#armTimeout(job, controller);
    try {
      await unlessAborted(controller.signal, this.#inScope(job, started, controller.signal));
      return this.recorder.succeeded(job, started);
    } catch (error) {
      return this.recorder.failed(job, started, error);
    } finally {
      disarm();
      job.abort = undefined;
    }
  }

  #armTimeout(job: RegisteredJob, controller: AbortController): () => void {
    const { timeoutMs } = job.policy;
    if (timeoutMs === undefined) return () => undefined;
    return this.options.timers.schedule(timeoutMs, () => {
      controller.abort(new JobTimeoutError(job.name, timeoutMs));
    });
  }

  #inScope(job: RegisteredJob, started: StartedRun, signal: AbortSignal): Promise<void> {
    const { occurrence, startedAt, correlationId } = started;
    const { scheduledAt } = occurrence;
    const { timeoutMs } = job.policy;
    const context = executionContextOfJob(job.name, {
      correlationId,
      scheduledAt,
      ...(timeoutMs === undefined ? {} : { deadline: new Date(startedAt.getTime() + timeoutMs) }),
    });
    const execution = { scheduledAt, startedAt, attempt: 1, signal };
    return this.options.scope.run(context, async () => job.definition.run(execution));
  }
}

/** A job that ignores its signal is left behind: the run ends when the signal is aborted. */
function unlessAborted(signal: AbortSignal, work: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(reasonOf(signal));
      },
      { once: true },
    );
    work.then(resolve, reject);
  });
}

function reasonOf(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error('The run was aborted.');
}
