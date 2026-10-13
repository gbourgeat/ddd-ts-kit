import {
  isJobName,
  parseDuration,
  systemActor,
  type BackgroundJobType,
  type Clock,
  type EnqueuedBy,
  type EnqueuedJob,
  type EnqueueOptions,
  type ExecutionScope,
  type IdGenerator,
  type JobQueue,
  type QueuedJob,
} from '@ddd-ts-kit/kernel';
import { InvalidEnqueueError } from './errors/invalid-enqueue-error.js';
import type { JobStore } from './store/job-store.js';

export interface StoredJobQueueOptions {
  readonly store: JobStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Where the correlation, the actor and the tenant of the work that enqueues are read. */
  readonly scope: ExecutionScope;
  /** The `traceparent` of the active span, stored with the job: `captureTraceparent` of `@ddd-ts-kit/tracing`. */
  readonly traceparent?: () => string | undefined;
}

/**
 * The `JobQueue` of the kernel on a `JobStore`: it names the job, captures what travels with it
 * and adds it to the store, in the transaction of the caller when the store shares it.
 */
export class StoredJobQueue implements JobQueue {
  constructor(private readonly options: StoredJobQueueOptions) {}

  async enqueue<Payload>(
    job: BackgroundJobType<Payload>,
    payload: NoInfer<Payload>,
    options: EnqueueOptions = {},
  ): Promise<EnqueuedJob> {
    const name = nameOf(job);
    const enqueuedAt = this.options.clock.now();
    const { idempotencyKey } = options;

    return this.options.store.add({
      id: this.options.ids.next(),
      name,
      queue: queueOf(name),
      payload,
      enqueuedBy: this.enqueuedBy(name),
      enqueuedAt,
      runAt: runAtOf(options, enqueuedAt),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    });
  }

  cancel(id: string): Promise<boolean> {
    return this.options.store.cancel(id, this.options.clock.now());
  }

  find(id: string): Promise<QueuedJob | undefined> {
    return this.options.store.find(id);
  }

  /** Outside of any execution scope (a script, a test), the job acts as itself, under a correlation of its own. */
  private enqueuedBy(name: string): EnqueuedBy {
    const context = this.options.scope.current();
    const traceparent = this.options.traceparent?.();
    const traced = traceparent === undefined ? {} : { traceparent };

    if (context === undefined) {
      return { correlationId: this.options.ids.next(), actor: systemActor(name), ...traced };
    }

    const { correlationId, actor, tenantId } = context;

    return { correlationId, actor, ...(tenantId === undefined ? {} : { tenantId }), ...traced };
  }
}

function nameOf(job: { readonly jobName: string }): string {
  if (!isJobName(job.jobName)) {
    throw InvalidEnqueueError.unnamed(job.jobName);
  }

  return job.jobName;
}

/** The queue of a job is its context: the first part of its name. */
function queueOf(name: string): string {
  return name.split('.', 1).join('');
}

function runAtOf({ delay, runAt }: EnqueueOptions, now: Date): Date {
  if (delay !== undefined && runAt !== undefined) {
    throw InvalidEnqueueError.twoInstants();
  }

  if (delay !== undefined) {
    return new Date(now.getTime() + parseDuration(delay));
  }

  return runAt ?? now;
}
