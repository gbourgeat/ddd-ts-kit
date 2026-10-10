import { systemActor } from './actor.js';
import { executionContext, type ExecutionContext } from './execution-context.js';
import { InvalidJobScheduleError, parseDuration, type JobSchedule } from './job-schedule.js';

/** What a run is told about itself. */
export interface JobExecution {
  /** The instant the run was due. For `runNow`, the instant it was asked. */
  readonly scheduledAt: Date;
  /** The instant the run really started: later than `scheduledAt` by the jitter, a queue or a catch-up. */
  readonly startedAt: Date;
  /** 1 for a scheduler that never retries, as the in-process one; a scheduler that redelivers counts. */
  readonly attempt: number;
  /** Aborted when the run exceeds its timeout or the scheduler stops: a long job checks it. */
  readonly signal: AbortSignal;
}

/**
 * A class of `application/scheduling/`. A job decides nothing: it triggers use cases, typically
 * by sending one command, and the business rules stay where they are.
 */
export interface ScheduledJob {
  run(execution: JobExecution): Promise<void>;
}

export interface JobOptions {
  /**
   * An occurrence that comes while the previous run is still in progress: `skip` (default) does
   * not start it, `queue` starts it when the run ends, one occurrence waiting at most.
   */
  readonly overlap?: 'skip' | 'queue';
  /**
   * Occurrences that passed without the scheduler reaching them in time (the process was down,
   * asleep or blocked): `skip` (default) waits for the next one, `run-once` runs the latest of
   * them, once, however many passed.
   */
  readonly missed?: 'skip' | 'run-once';
  /** Aborts a run that lasts longer, through its signal. Default: no limit. */
  readonly timeoutMs?: number;
  /** A random delay up to this many milliseconds before each run, so jobs do not all start on the minute. Default 0. */
  readonly jitterMs?: number;
  /** `false` never starts the job by time. Default `true`. Meant to be overridden from configuration. */
  readonly enabled?: boolean;
  /**
   * `true` (default): the scheduler takes the `Lock` of the occurrence, so that one instance of
   * an application running several runs it. Best effort: see the scheduler.
   */
  readonly singleInstance?: boolean;
}

/** The options with their defaults filled in. */
export type JobPolicy = Required<Omit<JobOptions, 'timeoutMs'>> & Pick<JobOptions, 'timeoutMs'>;

/** What a configuration may change of a declared job, without a code change. */
export interface JobSettings extends JobOptions {
  readonly schedule?: JobSchedule;
}

/** A job as a scheduler receives it. */
export interface JobDefinition extends JobOptions {
  /** `<context>.<job-name>`, unique in the application. */
  readonly name: string;
  readonly schedule: JobSchedule;
  readonly run: (execution: JobExecution) => Promise<void>;
}

/**
 * - `succeeded`, `failed`: the job ran.
 * - `skipped-overlap`: the previous run was still in progress.
 * - `skipped-locked`: another instance holds the occurrence.
 * - `missed`: the occurrence passed and was not run.
 */
export type JobOutcome = 'succeeded' | 'failed' | 'skipped-overlap' | 'skipped-locked' | 'missed';

/** One occurrence and what became of it, as data. Never the message of an error: it quotes data. */
export interface JobRun {
  readonly job: string;
  readonly outcome: JobOutcome;
  readonly scheduledAt: Date;
  /** Present when the job ran. */
  readonly startedAt?: Date;
  readonly durationMs?: number;
  /** The `code` of what the job threw, or `UNEXPECTED_ERROR`. */
  readonly errorCode?: string;
}

export interface JobDescription {
  readonly name: string;
  /** `every 15m`, `cron 0 7 * * 1-5 (Europe/Paris)`. */
  readonly schedule: string;
  readonly enabled: boolean;
  readonly running: boolean;
  /** Absent for a disabled job and for a scheduler that is not started. */
  readonly nextRunAt?: Date;
  /** The last occurrence this instance handled, whatever became of it. */
  readonly lastRun?: JobRun;
}

/**
 * Runs jobs when they are due. Not the timer of `@ddd-ts-kit/aspects`: this one knows jobs,
 * schedules and instances. A failing job stops neither the scheduler nor the other jobs.
 */
export interface JobScheduler {
  /** Throws `DuplicateJobError` for a name already registered, `InvalidJobScheduleError` for a schedule it cannot read. */
  register(job: JobDefinition): void;
  /** Starts running the enabled jobs by time. Starting twice does nothing. */
  start(): Promise<void>;
  /** Stops starting runs, waits for those in progress up to a grace period, then aborts them through their signal. */
  stop(): Promise<void>;
  /**
   * Runs a job at once, enabled or not, for an operation or a test, and answers what became of
   * it. A job that fails answers `failed`: only an unknown name rejects, with `UnknownJobError`.
   */
  runNow(name: string): Promise<JobRun>;
  describe(): readonly JobDescription[];
}

export class DuplicateJobError extends Error {
  readonly code = 'DUPLICATE_JOB';

  constructor(readonly job: string) {
    super(`A job named "${job}" is already registered: a job name is unique in an application.`);
    this.name = 'DuplicateJobError';
  }
}

export class UnknownJobError extends Error {
  readonly code = 'UNKNOWN_JOB';

  constructor(readonly job: string) {
    super(`No job is named "${job}".`);
    this.name = 'UnknownJobError';
  }
}

const JOB_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/;

/** A job name is `<context>.<job-name>`, in lower case, words separated by dashes. */
export function isJobName(name: string): boolean {
  return JOB_NAME.test(name);
}

/** Validates the options and fills in the defaults. Throws `InvalidJobScheduleError`. */
export function jobPolicy(options: JobOptions): JobPolicy {
  const { overlap = 'skip', missed = 'skip', timeoutMs, jitterMs = 0, enabled = true, singleInstance = true } = options;
  assertOneOf('overlap', overlap, ['skip', 'queue']);
  assertOneOf('missed', missed, ['skip', 'run-once']);
  if (!Number.isSafeInteger(jitterMs) || jitterMs < 0) {
    throw new InvalidJobScheduleError(`jitterMs is ${jitterMs}: a whole number of milliseconds, zero or more, is expected.`);
  }
  if (timeoutMs === undefined) return { overlap, missed, jitterMs, enabled, singleInstance };
  return { overlap, missed, jitterMs, enabled, singleInstance, timeoutMs: parseDuration(timeoutMs) };
}

function assertOneOf(option: string, value: string, allowed: readonly string[]): void {
  if (allowed.includes(value)) return;
  throw new InvalidJobScheduleError(`${option} is "${value}": one of ${allowed.join(', ')} is expected.`);
}

export interface JobExecutionStart {
  readonly correlationId: string;
  readonly scheduledAt: Date;
  /** The instant the timeout of the job ends the run, when it has one. */
  readonly deadline?: Date;
}

/**
 * The execution context of one run: origin `schedule`, the system actor named after the job, a
 * correlation of its own and the instant the run was due.
 */
export function executionContextOfJob(job: string, start: JobExecutionStart): ExecutionContext {
  return executionContext({ ...start, actor: systemActor(job), origin: 'schedule' });
}
