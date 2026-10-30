import {
  isJobName,
  parseDuration,
  systemActor,
  type Actor,
  type BackgroundJobType,
  type Clock,
  type EnqueuedBy,
  type EnqueuedJob,
  type EnqueueOptions,
  type ExecutionContext,
  type ExecutionScope,
  type IdGenerator,
  type JobQueue,
  type QueuedJob,
} from '@ddd-ts-kit/kernel';
import { InvalidEnqueueError } from './errors/invalid-enqueue-error';
import { InvalidEnqueuedPayloadError } from './errors/invalid-enqueued-payload-error';
import type { JobStore } from './store/job-store';

export interface StoredJobQueueOptions {
  readonly store: JobStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Where the correlation, the actor and the tenant of the work that enqueues are read. */
  readonly scope: ExecutionScope;
  /** The `traceparent` of the active span, stored with the job: `captureTraceparent` of `@ddd-ts-kit/tracing`. */
  readonly traceparent?: () => string | undefined;
  /**
   * The attributes of the actor a run reads, beyond `tenants`, stored with the job: an attribute a
   * policy asks of a job (`department`). Default none: a stored job keeps who acts and never the
   * profile a credential gave, an email or a username, which would outlive an erasure of the person.
   */
  readonly actorAttributes?: readonly string[];
}

/** What the authorizer reads of an actor that belongs to several tenants (`tenantsOf`). */
const AUTHORIZING_ATTRIBUTES: readonly string[] = ['tenants'];

/**
 * The `JobQueue` of the kernel on a `JobStore`: it names the job, reads the payload with the
 * schema of the job (a payload it refuses throws `InvalidEnqueuedPayloadError`, nothing stored),
 * captures what travels with it and adds it to the store, in the transaction of the caller when the store shares it: the
 * correlation, the tenant, the trace, and of the actor its id, type, tenant, roles and `tenants`, never its profile. `find`
 * and `cancel` reach the jobs of the tenant of the work in progress only (the tenants of its
 * elevation), every job when the work has no tenant.
 */
export class StoredJobQueue implements JobQueue {
  constructor(private readonly options: StoredJobQueueOptions) {}

  async enqueue<Payload>(
    job: BackgroundJobType<Payload>,
    payload: NoInfer<Payload>,
    options: EnqueueOptions = {},
  ): Promise<EnqueuedJob> {
    const name = nameOf(job);

    assertFits(job, name, payload);

    const enqueuedAt = this.options.clock.now();
    const { idempotencyKey, subject } = options;

    return this.options.store.add({
      id: this.options.ids.next(),
      name,
      queue: queueOf(name),
      payload,
      enqueuedBy: this.enqueuedBy(name),
      enqueuedAt,
      runAt: runAtOf(options, enqueuedAt),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      ...(subject === undefined ? {} : { subject }),
    });
  }

  async cancel(id: string): Promise<boolean> {
    if ((await this.find(id)) === undefined) {
      return false;
    }

    return this.options.store.cancel(id, this.options.clock.now());
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const job = await this.options.store.find(id);

    return job !== undefined && isInReach(job, this.options.scope.current()) ? job : undefined;
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

    return {
      correlationId,
      actor: this.storedActor(actor),
      ...(tenantId === undefined ? {} : { tenantId }),
      ...traced,
    };
  }

  /** The actor as a run needs it. A row outlives the request, so the rest of its attributes stays with the request. */
  private storedActor(actor: Actor): Actor {
    const kept = [...AUTHORIZING_ATTRIBUTES, ...(this.options.actorAttributes ?? [])];

    return {
      ...actor,
      attributes: Object.fromEntries(Object.entries(actor.attributes).filter(([name]) => kept.includes(name))),
    };
  }
}

function isInReach(job: QueuedJob, context: ExecutionContext | undefined): boolean {
  const elevated = context?.elevation?.tenants;

  if (elevated !== undefined) {
    return elevated === 'all' || (job.tenantId !== undefined && elevated.includes(job.tenantId));
  }

  return context?.tenantId === undefined || job.tenantId === context.tenantId;
}

function nameOf(job: { readonly jobName: string }): string {
  if (!isJobName(job.jobName)) {
    throw InvalidEnqueueError.unnamed(job.jobName);
  }

  return job.jobName;
}

/** The payload is stored as the caller wrote it: the worker reads it again, with the schema of the version that runs it. */
function assertFits(job: Pick<BackgroundJobType<unknown>, 'payload'>, name: string, payload: unknown): void {
  const parsed = job.payload.parse(payload);

  if (!parsed.ok) {
    throw new InvalidEnqueuedPayloadError(name, parsed.error);
  }
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
