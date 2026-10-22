import { InvalidJobScheduleError } from '../../application/scheduling/invalid-job-schedule-error';
import { isJobName } from '../../application/scheduling/is-job-name';
import type { JobOptions } from '../../application/scheduling/job-options';
import { jobPolicy } from '../../application/scheduling/job-policy';
import { jobScheduleOf } from '../../application/scheduling/job-schedule-of';
import type { JobSchedule } from '../../application/scheduling/job-schedule';
import type { ScheduledJob } from '../../application/scheduling/scheduled-job';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import { DeclarationError } from '../registry/declaration-error';
import { record } from '../registry/record';

/** When the job runs, and the options of `JobOptions` next to it: `{ every: '15m', overlap: 'queue' }`. */
export type ScheduledOptions = JobSchedule & JobOptions;

/**
 * A job run by time, which triggers use cases and decides nothing, under a stable name:
 * `@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })`.
 * The name and the schedule are checked when the file loads: a name that is not
 * `<context>.<job-name>`, an unreadable cron, a zero interval or an unknown time zone throw.
 */
export function Scheduled<const D extends DeclaredDependencies = DependenciesFromSignature>(
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
    record(target, { role: 'job', name, schedule, options, implementation: target, dependencies });
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
