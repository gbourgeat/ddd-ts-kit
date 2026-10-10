import {
  describeJobSchedule,
  jobPolicy,
  parseJobSchedule,
  type JobDefinition,
  type JobPolicy,
  type JobRun,
  type LockHandle,
  type ParsedJobSchedule,
} from '@ddd-ts-kit/kernel';

/** One occurrence to run: due by time, or asked for with `runNow`. */
export interface Occurrence {
  readonly scheduledAt: Date;
  readonly manual: boolean;
}

/** A job and what this instance knows of it. Held by the scheduler alone. */
export class RegisteredJob {
  readonly name: string;
  readonly policy: JobPolicy;
  readonly schedule: ParsedJobSchedule;
  readonly scheduleText: string;
  /** The last occurrence handled, or the instant the scheduler started following the job. */
  cursor: Date | undefined;
  cancelSleep: (() => void) | undefined;
  /** The run in progress, or the one waiting behind it. */
  active: Promise<JobRun> | undefined;
  waiting = false;
  lastRun: JobRun | undefined;
  /** The lock of the last occurrence run, kept until the next one so that no instance runs it again. */
  held: LockHandle | undefined;
  abort: ((reason: Error) => void) | undefined;

  constructor(readonly definition: JobDefinition) {
    this.name = definition.name;
    this.policy = jobPolicy(definition);
    this.schedule = parseJobSchedule(definition.schedule);
    this.scheduleText = describeJobSchedule(definition.schedule);
  }
}
