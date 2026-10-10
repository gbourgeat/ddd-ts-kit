import { CliError } from '../../../cli-error.js';
import type { KindFlags } from '../../kind.js';
import type { JobSchedule } from '../../schedule/job-schedule.js';
import { jobScheduleProblem } from '../../schedule/job-schedule-problem.js';

const SAMPLE = '--every 15m, or --cron "0 7 * * 1-5" --time-zone Europe/Paris';

/** The schedule `--every`, or `--cron` and `--time-zone`, ask for: exactly one of the two, and one the scheduler can read. */
export function requestedSchedule({ every, cron, timeZone }: KindFlags): JobSchedule {
  if ((every === undefined) === (cron === undefined)) {
    throw new CliError(
      every === undefined ? 'A job needs a schedule.' : '--every and --cron exclude each other.',
      `Pass exactly one of the two: ${SAMPLE}.`,
    );
  }

  if (cron === undefined && timeZone !== undefined) {
    throw new CliError(
      '--time-zone needs --cron.',
      'An interval is aligned on the Unix epoch and reads no clock: drop --time-zone, or give the schedule as a cron expression.',
    );
  }

  const schedule =
    every === undefined
      ? { ...(cron === undefined ? {} : { cron }), ...(timeZone === undefined ? {} : { timeZone }) }
      : { every };

  const problem = jobScheduleProblem(schedule);

  if (problem !== undefined) {
    throw new CliError(problem, `Pass a schedule the scheduler can read: ${SAMPLE}.`);
  }

  return schedule;
}
