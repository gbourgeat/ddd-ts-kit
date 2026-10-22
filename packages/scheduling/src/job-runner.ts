import {
  executionContextOfJob,
  type Clock,
  type ExecutionScope,
  type IdGenerator,
  type JobRun,
  type Lock,
  type TenantDirectory,
} from '@ddd-ts-kit/kernel';
import { JobLockUnavailableError } from './errors/job-lock-unavailable-error';
import { JobTimeoutError } from './errors/job-timeout-error';
import type { JobRecorder } from './job-recorder';
import type { JobTimers } from './job-timers';
import type { Occurrence } from './occurrence';
import type { RegisteredJob } from './registered-job';
import type { StartedRun } from './started-run';
import { unlessAborted } from './unless-aborted';

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
  /** Where a per-tenant job finds its tenants. */
  readonly tenants?: TenantDirectory;
}

/** One run of an occurrence, in a tenant for a per-tenant job. */
interface TenantRun {
  readonly started: StartedRun;
  readonly signal: AbortSignal;
  readonly tenantId?: string;
}

/** Runs one occurrence: the lock of the occurrence, the execution scope, the timeout. */
export class JobRunner {
  constructor(
    private readonly options: RunnerOptions,
    private readonly recorder: JobRecorder,
  ) {}

  knowsTenants(): boolean {
    return this.options.tenants !== undefined;
  }

  /** Answers what became of the occurrence. Never rejects. */
  async run(job: RegisteredJob, occurrence: Occurrence): Promise<JobRun> {
    try {
      const held = await this.holds(job, occurrence);

      return held ? await this.execute(job, occurrence) : this.recorder.notRun(job, occurrence, 'skipped-locked');
    } catch (error) {
      return this.recorder.refused(job, occurrence, error);
    }
  }

  /*
   * The lock is not released when the run ends: an instance whose timer fires a little later
   * would take it and run the occurrence again. It is kept until this instance handles the next
   * occurrence of the job, or until its time to live has passed.
   */
  private async holds(job: RegisteredJob, { scheduledAt, manual }: Occurrence): Promise<boolean> {
    if (!job.policy.singleInstance || manual) {
      return true;
    }

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

  private async execute(job: RegisteredJob, occurrence: Occurrence): Promise<JobRun> {
    const started = { occurrence, startedAt: this.options.clock.now(), correlationId: this.options.ids.next() };
    const controller = new AbortController();

    job.abort = (reason) => {
      controller.abort(reason);
    };

    const disarm = this.armTimeout(job, controller);

    try {
      await unlessAborted(controller.signal, this.inScope(job, started, controller.signal));

      return this.recorder.succeeded(job, started);
    } catch (error) {
      return this.recorder.failed(job, started, error);
    } finally {
      disarm();
      job.abort = undefined;
    }
  }

  private armTimeout(job: RegisteredJob, controller: AbortController): () => void {
    const { timeoutMs } = job.policy;

    if (timeoutMs === undefined) {
      return () => undefined;
    }

    return this.options.timers.schedule(timeoutMs, () => {
      controller.abort(new JobTimeoutError(job.name, timeoutMs));
    });
  }

  private async inScope(job: RegisteredJob, started: StartedRun, signal: AbortSignal): Promise<void> {
    if (job.policy.tenancy === 'global' || this.options.tenants === undefined) {
      return this.inTenant(job, { started, signal });
    }

    await eachTenant(await this.options.tenants.tenants(), signal, (tenantId) =>
      this.inTenant(job, { started, signal, tenantId }),
    );
  }

  private async inTenant(job: RegisteredJob, { started, signal, tenantId }: TenantRun): Promise<void> {
    const { occurrence, startedAt, correlationId } = started;
    const { scheduledAt } = occurrence;
    const { timeoutMs } = job.policy;
    const tenant = tenantId === undefined ? {} : { tenantId };

    const context = executionContextOfJob(job.name, {
      correlationId,
      scheduledAt,
      ...(timeoutMs === undefined ? {} : { deadline: new Date(startedAt.getTime() + timeoutMs) }),
      ...tenant,
    });

    const execution = { scheduledAt, startedAt, attempt: 1, signal, ...tenant };

    return this.options.scope.run(context, async () => job.definition.run(execution));
  }
}

/**
 * One run per tenant, one after the other, so that a job never holds more than one tenant's
 * work at a time. A tenant that fails does not stop the others; the occurrence then fails with
 * the first error, once every tenant had its run. An aborted signal stops before the next tenant.
 */
async function eachTenant(
  tenants: readonly string[],
  signal: AbortSignal,
  run: (tenantId: string) => Promise<void>,
): Promise<void> {
  const failures: unknown[] = [];

  for (const tenantId of tenants) {
    if (signal.aborted) {
      return;
    }

    await run(tenantId).catch((error: unknown) => failures.push(error));
  }

  if (failures.length > 0) {
    throw failures[0];
  }
}
