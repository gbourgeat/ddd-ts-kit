import {
  DuplicateJobError,
  NoopLogger,
  NoopMetrics,
  UnknownJobError,
  type Clock,
  type ExecutionScope,
  type IdGenerator,
  type JobDefinition,
  type JobDescription,
  type JobRun,
  type JobScheduler,
  type Lock,
  type Logger,
  type Metrics,
} from '@ddd-ts-kit/kernel';
import { JobAbortedError } from './errors.js';
import { latestOccurrence, nextOccurrence } from './occurrences.js';
import { JobRecorder, type JobRunObserver } from './recorder.js';
import { RegisteredJob, type Occurrence } from './registered-job.js';
import { JobRunner } from './runner.js';
import { systemJobTimers, type JobTimers } from './timers.js';

/**
 * Where a scheduler remembers the last occurrence it handled for each job, so that a restart
 * knows what passed while the process was down. Shared by the instances of an application: a
 * table, a key of a store.
 */
export interface JobCheckpoints {
  read(job: string): Promise<Date | undefined>;
  write(job: string, handled: Date): Promise<void>;
}

export interface InProcessJobSchedulerOptions {
  /** Every instant comes from it: the system clock is never read. */
  readonly clock: Clock;
  /** Taken for each occurrence of a `singleInstance` job. Between processes only with an adapter that is. */
  readonly lock: Lock;
  /** Each run happens inside it, in a context of origin `schedule`. */
  readonly scope: ExecutionScope;
  /** Gives each run its correlation id. */
  readonly ids: IdGenerator;
  /** Default: writes nothing. */
  readonly logger?: Logger;
  /** Default: measures nothing. */
  readonly metrics?: Metrics;
  /** Default: the timers of the runtime. */
  readonly timers?: JobTimers;
  /** Default: none, and a restart forgets what passed while the process was down. */
  readonly checkpoints?: JobCheckpoints;
  /** Draws the jitter, in [0, 1). Default `Math.random`. */
  readonly random?: () => number;
  /** An occurrence reached later than this, jitter aside, is missed. Default 60 000. */
  readonly lateAfterMs?: number;
  /** How long `stop()` waits for the runs in progress before aborting them. Default 30 000. */
  readonly graceMs?: number;
  /** How long the lock of an occurrence is kept for a job without `timeoutMs`. Default 900 000. */
  readonly lockTtlMs?: number;
  readonly onRun?: JobRunObserver;
}

type Settings = Required<Omit<InProcessJobSchedulerOptions, 'checkpoints' | 'onRun' | 'lock' | 'scope' | 'ids'>> &
  Pick<InProcessJobSchedulerOptions, 'checkpoints'>;

/*
 * A sleep never lasts longer: the wall clock and the timers of the runtime drift apart, and a
 * timer of the runtime cannot wait more than 24 days. A timer that fires early finds nothing
 * due and sleeps again.
 */
const LONGEST_SLEEP_MS = 3_600_000;

/**
 * The scheduler inside one process. Instants come from the `Clock`, sleeps go through the
 * timers, and nothing is remembered across a restart unless `checkpoints` is given. Several
 * instances of an application each run one: the `Lock` decides which of them runs an occurrence.
 */
export class InProcessJobScheduler implements JobScheduler {
  readonly #jobs = new Map<string, RegisteredJob>();
  readonly #ticks = new Set<Promise<void>>();
  readonly #runs = new Set<Promise<JobRun>>();
  readonly #settings: Settings;
  readonly #recorder: JobRecorder;
  readonly #runner: JobRunner;
  #started = false;
  #stopping = false;

  constructor(options: InProcessJobSchedulerOptions) {
    const { clock, logger = new NoopLogger(), metrics = new NoopMetrics(), timers = systemJobTimers } = options;
    const { lateAfterMs = 60_000, graceMs = 30_000, lockTtlMs = 900_000, random = Math.random, checkpoints, onRun } = options;
    this.#settings = { clock, logger, metrics, timers, lateAfterMs, graceMs, lockTtlMs, random, ...(checkpoints === undefined ? {} : { checkpoints }) };
    this.#recorder = new JobRecorder({ clock, logger, metrics, ...(onRun === undefined ? {} : { onRun }) });
    const { lock, scope, ids } = options;
    this.#runner = new JobRunner({ clock, lock, scope, ids, timers, lockTtlMs, lateAfterMs }, this.#recorder);
  }

  register(definition: JobDefinition): void {
    if (this.#jobs.has(definition.name)) throw new DuplicateJobError(definition.name);
    const job = new RegisteredJob(definition);
    this.#jobs.set(job.name, job);
    if (this.#started) void this.#follow(job, this.#begin(job));
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await Promise.all([...this.#jobs.values()].map((job) => this.#follow(job, this.#begin(job))));
  }

  async stop(): Promise<void> {
    this.#started = false;
    this.#stopping = true;
    for (const job of this.#jobs.values()) job.cancelSleep?.();
    await Promise.all(this.#ticks);
    const cancelAbort = this.#settings.timers.schedule(this.#settings.graceMs, () => {
      for (const job of this.#jobs.values()) job.abort?.(new JobAbortedError(job.name));
    });
    await Promise.all(this.#runs);
    cancelAbort();
    this.#stopping = false;
  }

  async runNow(name: string): Promise<JobRun> {
    const job = this.#jobs.get(name);
    if (job === undefined) throw new UnknownJobError(name);
    return this.#trigger(job, { scheduledAt: this.#settings.clock.now(), manual: true });
  }

  describe(): readonly JobDescription[] {
    return [...this.#jobs.values()].map((job) => ({
      name: job.name,
      schedule: job.scheduleText,
      enabled: job.policy.enabled,
      running: job.active !== undefined,
      ...(this.#started && job.cursor !== undefined ? { nextRunAt: nextOccurrence(job.schedule, job.cursor) } : {}),
      ...(job.lastRun === undefined ? {} : { lastRun: job.lastRun }),
    }));
  }

  /** A tick never rejects: what goes wrong while following a job is logged, and the others go on. */
  #follow(job: RegisteredJob, tick: Promise<void>): Promise<void> {
    const followed = tick.catch((error: unknown) => {
      this.#recorder.fault(job, error);
    });
    this.#ticks.add(followed);
    return followed.finally(() => this.#ticks.delete(followed));
  }

  async #begin(job: RegisteredJob): Promise<void> {
    if (!job.policy.enabled) return;
    job.cursor = (await this.#remembered(job)) ?? this.#settings.clock.now();
    await this.#tick(job);
  }

  /** A checkpoint that cannot be read is no reason to leave the job asleep: it starts from now. */
  async #remembered(job: RegisteredJob): Promise<Date | undefined> {
    try {
      return await this.#settings.checkpoints?.read(job.name);
    } catch (error) {
      this.#recorder.fault(job, error);
      return undefined;
    }
  }

  async #tick(job: RegisteredJob): Promise<void> {
    try {
      await this.#handleDue(job);
    } finally {
      this.#sleep(job);
    }
  }

  /** Of the occurrences that became due, the latest is run when it is on time or owed; the others are missed. */
  async #handleDue(job: RegisteredJob): Promise<void> {
    const now = this.#settings.clock.now();
    const after = job.cursor ?? now;
    const due = latestOccurrence(job.schedule, { after, notAfter: now });
    if (due === undefined) return;
    job.cursor = due;
    const earliest = nextOccurrence(job.schedule, after);
    const late = now.getTime() - due.getTime() > this.#settings.lateAfterMs + job.policy.jitterMs;
    const runs = !late || job.policy.missed === 'run-once';
    if (!runs || earliest.getTime() < due.getTime()) this.#recorder.notRun(job, { scheduledAt: earliest, manual: false }, 'missed');
    if (runs) void this.#trigger(job, { scheduledAt: due, manual: false });
    await this.#settings.checkpoints?.write(job.name, due);
  }

  #sleep(job: RegisteredJob): void {
    if (!this.#started || job.cursor === undefined) return;
    const { clock, timers, random } = this.#settings;
    const untilNext = nextOccurrence(job.schedule, job.cursor).getTime() - clock.now().getTime();
    const jitter = Math.floor(random() * (job.policy.jitterMs + 1));
    job.cancelSleep = timers.schedule(Math.min(Math.max(0, untilNext), LONGEST_SLEEP_MS) + jitter, () => {
      void this.#follow(job, this.#tick(job));
    });
  }

  #trigger(job: RegisteredJob, occurrence: Occurrence): Promise<JobRun> {
    const previous = job.active;
    if (previous === undefined) return this.#occupy(job, this.#runner.run(job, occurrence));
    if (job.policy.overlap === 'skip' || job.waiting) {
      return Promise.resolve(this.#recorder.notRun(job, occurrence, 'skipped-overlap'));
    }
    job.waiting = true;
    return this.#occupy(job, previous.then(() => this.#afterPrevious(job, occurrence)));
  }

  #occupy(job: RegisteredJob, run: Promise<JobRun>): Promise<JobRun> {
    const active = run.finally(() => {
      this.#runs.delete(active);
      if (job.active === active) job.active = undefined;
    });
    job.active = active;
    this.#runs.add(active);
    return active;
  }

  /** A run that waited behind another is dropped when the scheduler is stopping. */
  #afterPrevious(job: RegisteredJob, occurrence: Occurrence): JobRun | Promise<JobRun> {
    job.waiting = false;
    return this.#stopping ? this.#recorder.notRun(job, occurrence, 'missed') : this.#runner.run(job, occurrence);
  }
}
