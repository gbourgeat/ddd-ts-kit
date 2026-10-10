import { cronProblem } from './cron-problem.js';
import { durationProblem } from './duration-problem.js';
import type { JobSchedule } from './job-schedule.js';

/**
 * Why a schedule cannot be written in a job, or undefined. The CLI has no dependency, so this is
 * the judgement of `parseJobSchedule` of the kernel written again; a test holds the two together.
 */
export function jobScheduleProblem({ every, cron, timeZone }: JobSchedule): string | undefined {
  if (every !== undefined) {
    return durationProblem(every);
  }

  if (cron === undefined) {
    return 'A schedule is an interval or a cron expression.';
  }

  return cronProblem(cron) ?? timeZoneProblem(timeZone ?? 'UTC');
}

function timeZoneProblem(timeZone: string): string | undefined {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });

    return undefined;
  } catch {
    return `"${timeZone}" is not a time zone this runtime knows: write an IANA name such as Europe/Paris.`;
  }
}
