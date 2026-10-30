import { DuplicateJobError, NoopLogger, NoopMetrics, ok, type BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';
import { systemJobTimers } from '../system-job-timers';
import type { BackgroundJobDefinition } from './background-job-definition';
import { BackgroundJobRecorder } from './background-job-recorder';
import type { BackgroundJobRun } from './background-job-run';
import { ClaimedJobRunner } from './claimed-job-runner';
import { AttemptsExhaustedError } from './errors/attempts-exhausted-error';
import { UnknownBackgroundJobError } from './errors/unknown-background-job-error';
import type { QueueState } from './queue-state';
import type { QueueWorkerOptions } from './queue-worker-options';
import { RegisteredBackgroundJob } from './registered-background-job';
import type { ClaimedJob } from './store/claimed-job';

/** The schema of a job no module registered: it is never run, so its payload is never read. */
const unread: BackgroundJobPayloadSchema<unknown> = { parse: (input) => ok(input) };

/**
 * Runs the background jobs of the queues it has jobs for, in this process: each queue is the
 * context of its jobs, so a worker given the modules of some contexts consumes their queues and
 * no other. Delivery is at least once: a job whose worker died comes back when its lease ends.
 */
export class QueueWorker {
  private readonly jobs = new Map<string, RegisteredBackgroundJob>();

  private readonly queues = new Map<string, QueueState>();

  private readonly recorder: BackgroundJobRecorder;

  private readonly runner: ClaimedJobRunner;

  private stopping = new AbortController();

  private running = false;

  constructor(private readonly options: QueueWorkerOptions) {
    const { logger = new NoopLogger(), metrics = new NoopMetrics(), onRun } = options;
    const { store, clock, scope, timers = systemJobTimers } = options;

    this.recorder = new BackgroundJobRecorder({ logger, metrics, ...(onRun === undefined ? {} : { onRun }) });
    this.runner = new ClaimedJobRunner({ store, clock, scope, timers }, this.recorder);
  }

  /** Throws `DuplicateJobError` for a name already registered, `InvalidJobScheduleError` for options it cannot read. */
  register(definition: BackgroundJobDefinition): void {
    if (this.jobs.has(definition.name)) {
      throw new DuplicateJobError(definition.name);
    }

    const job = new RegisteredBackgroundJob(definition);

    this.jobs.set(job.name, job);
    this.followed(job.queue);
  }

  /** The names of the queues this worker consumes. */
  queueNames(): readonly string[] {
    return [...this.queues.keys()];
  }

  /** Starts claiming. Starting twice does nothing. */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopping = new AbortController();
    await Promise.all([...this.queues.values()].map((queue) => this.pump(queue)));
  }

  /**
   * Stops claiming, waits for the attempts in progress up to the grace period, then aborts them:
   * an aborted attempt gives its job back, uncounted, for the next worker. A claim in flight
   * when it is called gives its jobs back the same way. Stopping is cooperative: a job that
   * ignores its signal goes on behind, and is claimed again once its lease ends.
   */
  async stop(): Promise<void> {
    this.running = false;

    for (const queue of this.queues.values()) {
      queue.cancelSleep?.();
    }

    const timers = this.options.timers ?? systemJobTimers;

    const cancelAbort = timers.schedule(this.options.graceMs ?? 30_000, () => {
      this.stopping.abort();
    });

    const queues = [...this.queues.values()];

    await Promise.all(queues.flatMap((queue) => (queue.filling === undefined ? [] : [queue.filling])));
    await Promise.all(queues.flatMap((queue) => [...queue.active]));
    cancelAbort();
  }

  /**
   * Claims and runs every job due now, queue after queue, until none is left, and answers the
   * attempts: for a test, or a command run once. Not while the worker runs.
   */
  async runDue(): Promise<BackgroundJobRun[]> {
    const runs: BackgroundJobRun[] = [];

    for (const queue of this.queues.values()) {
      for (let batch = await this.claimed(queue); batch.length > 0; batch = await this.claimed(queue)) {
        runs.push(...(await Promise.all(batch.map((job) => this.attempt(job)))));
      }
    }

    return runs;
  }

  private followed(name: string): void {
    if (this.queues.has(name)) {
      return;
    }

    this.queues.set(name, {
      name,
      concurrency: this.concurrencyOf(name),
      active: new Set<Promise<BackgroundJobRun>>(),
      filling: undefined,
      cancelSleep: undefined,
    });
  }

  private concurrencyOf(queue: string): number {
    const { concurrency = 1 } = this.options;

    if (typeof concurrency === 'number') {
      return concurrency;
    }

    return concurrency[queue] ?? concurrency['default'] ?? 1;
  }

  /** Claims while there is room and work; an idle queue sleeps, a full one waits for an attempt to end. */
  private async pump(queue: QueueState): Promise<void> {
    if (queue.filling !== undefined || !this.running) {
      return;
    }

    queue.filling = this.fillOrSleep(queue);
    await queue.filling;
  }

  /** Never rejects: a fault of the store is recorded, and the queue asks again after a poll. */
  private async fillOrSleep(queue: QueueState): Promise<void> {
    try {
      await this.fill(queue);
    } catch (error) {
      this.recorder.fault(queue.name, error);
      this.sleep(queue);
    } finally {
      queue.filling = undefined;
    }
  }

  private async fill(queue: QueueState): Promise<void> {
    while (this.running) {
      const room = queue.concurrency - queue.active.size;

      if (room <= 0) {
        return;
      }

      const claimed = await this.claimed(queue, room);

      if (this.stopped()) {
        await this.giveBack(claimed);

        return;
      }

      for (const job of claimed) {
        this.launch(queue, job);
      }

      if (claimed.length < room) {
        this.sleep(queue);

        return;
      }
    }
  }

  private claimed(queue: QueueState, limit = queue.concurrency): Promise<ClaimedJob[]> {
    const leases = [...this.jobs.values()].filter((job) => job.queue === queue.name).map((job) => job.policy.leaseMs);

    return this.options.store.claim({
      queue: queue.name,
      limit,
      now: this.options.clock.now(),
      leaseMs: Math.max(...leases),
    });
  }

  /** Read anew after an await: `stop()` may have been called while it waited. */
  private stopped(): boolean {
    return !this.running;
  }

  /** Jobs claimed while the worker stopped go back to the store, their attempt not counted. */
  private async giveBack(claimed: readonly ClaimedJob[]): Promise<void> {
    const now = this.options.clock.now();

    await Promise.all(claimed.map((job) => this.options.store.release({ id: job.id, attempt: job.attempt }, now)));
  }

  private launch(queue: QueueState, job: ClaimedJob): void {
    const active = this.attempt(job).finally(() => {
      queue.active.delete(active);
      void this.pump(queue);
    });

    queue.active.add(active);
  }

  private attempt(job: ClaimedJob): Promise<BackgroundJobRun> {
    const registered = this.jobs.get(job.name);

    if (registered === undefined) {
      const stranger = new RegisteredBackgroundJob({ name: job.name, payload: unread, run: () => Promise.resolve() });

      return this.runner.refuse(job, stranger, { error: new UnknownBackgroundJobError(job.name), retry: true });
    }

    const { maxAttempts } = registered.policy;

    if (job.attempt > maxAttempts) {
      return this.runner.refuse(job, registered, {
        error: new AttemptsExhaustedError(job.name, maxAttempts),
        retry: false,
      });
    }

    return this.runner.run(job, registered, this.stopping.signal);
  }

  private sleep(queue: QueueState): void {
    if (!this.running) {
      return;
    }

    const timers = this.options.timers ?? systemJobTimers;

    queue.cancelSleep?.();

    queue.cancelSleep = timers.schedule(this.options.pollIntervalMs ?? 1_000, () => {
      void this.pump(queue);
    });
  }
}
