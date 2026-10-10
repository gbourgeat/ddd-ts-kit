import { isJobName, jobPolicy, type JobOptions, type ScheduledJob } from '../application/job.js';
import { InvalidJobScheduleError, jobScheduleOf, type JobSchedule } from '../application/job-schedule.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { DeclarationError, record } from './registry.js';

/** When the job runs, and the options of `JobOptions` next to it: `{ every: '15m', overlap: 'queue' }`. */
export type ScheduledOptions = JobSchedule & JobOptions;

/**
 * A job run by time, which triggers use cases and decides nothing, under a stable name:
 * `@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [COMMAND_BUS])`.
 * The name and the schedule are checked when the file loads: a name that is not
 * `<context>.<job-name>`, an unreadable cron, a zero interval or an unknown time zone throw.
 */
export function Scheduled<const D extends Dependencies = readonly []>(
  name: `${string}.${string}`,
  settings: ScheduledOptions,
  dependencies?: D,
): ClassDeclarator<ScheduledJob, D> {
  const schedule = scheduleOf(name, settings);
  const options = optionsOf(settings);
  if (!isJobName(name)) {
    throw new DeclarationError(
      `"${name}" is not a job name: write <context>.<job-name> in lower case, words separated by dashes, as in 'billing.send-reminders'.`,
    );
  }
  policyOf(name, options);
  return (target) => {
    record(target, { role: 'job', name, schedule, options, implementation: target, dependencies: dependencies ?? [] });
  };
}

function scheduleOf(name: string, settings: ScheduledOptions): JobSchedule {
  try {
    return jobScheduleOf(settings);
  } catch (error) {
    throw explained(name, error);
  }
}

function optionsOf(settings: ScheduledOptions): JobOptions {
  const { every: _every, cron: _cron, timeZone: _timeZone, ...options } = settings;
  return options;
}

function policyOf(name: string, options: JobOptions): void {
  try {
    jobPolicy(options);
  } catch (error) {
    throw explained(name, error);
  }
}

function explained(name: string, error: unknown): unknown {
  return error instanceof InvalidJobScheduleError ? new DeclarationError(`Job "${name}": ${error.message}`) : error;
}
