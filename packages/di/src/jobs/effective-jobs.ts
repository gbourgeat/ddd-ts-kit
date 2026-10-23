import {
  isJobName,
  jobPolicy,
  jobScheduleOf,
  type JobOptions,
  type JobSchedule,
  type JobSettings,
} from '@ddd-ts-kit/kernel';
import { WiringError } from '../errors/wiring-error';
import type { JobRegistration } from '../wiring/job-registration';
import { whereOf } from '../wiring/where-of';
import type { Wiring } from '../wiring/wiring';
import type { EffectiveJob } from './effective-job';
import type { JobsOptions } from './jobs-options';
import { readable } from './readable';

/** Every declared job as it will run. Throws before anything is instantiated. */
export function effectiveJobs(wiring: Wiring, options: JobsOptions = {}): EffectiveJob[] {
  const settings = options.settings ?? {};

  assertSettingsNameJobs(wiring, Object.keys(settings));

  return wiring.jobs.map((registration) => applied(registration, settings[registration.name] ?? {}));
}

function assertSettingsNameJobs({ jobs }: Wiring, configured: readonly string[]): void {
  const unknown = configured.find((name) => jobs.every((job) => job.name !== name));

  if (unknown === undefined) {
    return;
  }

  const declared = jobs.length === 0 ? 'none' : jobs.map((job) => `"${job.name}"`).join(', ');

  throw new WiringError(
    'UNKNOWN_JOB',
    `Settings are given for the job "${unknown}", which no module declares. Declared jobs: ${declared}.`,
  );
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

  const schedule: JobSchedule =
    configured === undefined ? registration.schedule : readable(name, () => jobScheduleOf(configured));

  return { ...registration, schedule, options, policy: readable(name, () => jobPolicy(options)) };
}

/** A key a configuration left undefined does not erase what the job declared. */
function written(overrides: JobOptions): JobOptions {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
}
