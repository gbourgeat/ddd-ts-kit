import {
  InvalidJobScheduleError,
  isJobName,
  jobPolicy,
  jobScheduleOf,
  type JobDefinition,
  type JobOptions,
  type JobPolicy,
  type JobSchedule,
  type JobSettings,
  type ScheduledJob,
} from '@ddd-ts-kit/kernel';
import type { ScheduledOptions } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from './errors.js';
import type { Token } from './token.js';
import { whereOf, type JobRegistration, type Resolve, type Wiring } from './wiring.js';

export interface JobsOptions {
  /**
   * `false`: the jobs are registered, described and run on demand with `runNow`, and
   * `start()` never starts the scheduler. For the process that serves requests next to a worker
   * that runs the jobs. Default `true`.
   */
  readonly start?: boolean;
  /**
   * What configuration changes of a declared job, by job name: `enabled`, the schedule, any
   * option. A name no module declares is refused, so a renamed job cannot stay switched on by a
   * stale key.
   */
  readonly settings?: Readonly<Record<string, JobSettings>>;
}

/** A declared job with the settings of the application applied and the defaults filled in. */
export interface EffectiveJob extends JobRegistration {
  readonly policy: JobPolicy;
}

interface Located {
  readonly module: string;
  readonly job: Token<ScheduledJob>;
}

/** The job of an explicit module: `builder.job('billing.send-reminders', { every: '15m' })`. */
export function writtenJob(name: string, settings: ScheduledOptions, located: Located): JobRegistration {
  const { every: _every, cron: _cron, timeZone: _timeZone, ...options } = settings;
  return { name, schedule: readable(name, () => jobScheduleOf(settings)), options, ...located };
}

/** Every declared job as it will run. Throws before anything is instantiated. */
export function effectiveJobs(wiring: Wiring, options: JobsOptions = {}): EffectiveJob[] {
  const settings = options.settings ?? {};
  assertSettingsNameJobs(wiring, Object.keys(settings));
  return wiring.jobs.map((registration) => applied(registration, settings[registration.name] ?? {}));
}

/** What a scheduler is given: the job is built on its first run, so a job that cannot be built fails that run. */
export function definitionOf(job: EffectiveJob, resolve: Resolve): JobDefinition {
  return { name: job.name, schedule: job.schedule, ...job.policy, run: async (execution) => resolve(job.job).run(execution) };
}

function assertSettingsNameJobs({ jobs }: Wiring, configured: readonly string[]): void {
  const unknown = configured.find((name) => jobs.every((job) => job.name !== name));
  if (unknown === undefined) return;
  const declared = jobs.length === 0 ? 'none' : jobs.map((job) => `"${job.name}"`).join(', ');
  throw new WiringError('UNKNOWN_JOB', `Settings are given for the job "${unknown}", which no module declares. Declared jobs: ${declared}.`);
}

function applied(registration: JobRegistration, settings: JobSettings): EffectiveJob {
  const { name } = registration;
  if (!isJobName(name)) {
    throw new WiringError(
      'INVALID_JOB_SETTINGS',
      `"${name}", declared in ${whereOf(registration)}, is not a job name: write <context>.<job-name> in lower case, words separated by dashes.`,
    );
  }
  const { schedule: configured, ...overrides } = settings;
  const options: JobOptions = { ...registration.options, ...written(overrides) };
  const schedule: JobSchedule = configured === undefined ? registration.schedule : readable(name, () => jobScheduleOf(configured));
  return { ...registration, schedule, options, policy: readable(name, () => jobPolicy(options)) };
}

/** A key a configuration left undefined does not erase what the job declared. */
function written(overrides: JobOptions): JobOptions {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
}

function readable<T>(name: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof InvalidJobScheduleError)) throw error;
    throw new WiringError('INVALID_JOB_SETTINGS', `Job "${name}": ${error.message}`, { cause: error });
  }
}
