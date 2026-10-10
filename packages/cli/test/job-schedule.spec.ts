import { describe, expect, it } from 'vitest';
import { parseJobSchedule, type JobSchedule as KernelSchedule } from '@ddd-ts-kit/kernel';
import { writtenSchedule } from '../src/generate/kinds/job/written-schedule.js';
import type { JobSchedule } from '../src/generate/schedule/job-schedule.js';
import { jobScheduleProblem } from '../src/generate/schedule/job-schedule-problem.js';

const VALID: readonly JobSchedule[] = [
  { every: '30s' },
  { every: '15m' },
  { every: '2h' },
  { every: '1d' },
  { every: '250ms' },
  { every: '900000' },
  { every: ' 15m ' },
  { cron: '0 7 * * 1-5' },
  { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' },
  { cron: '*/15 * * * *' },
  { cron: '0 0 1 jan *' },
  { cron: '0 0 * * mon,wed,fri' },
  { cron: '0 0 * * 7' },
  { cron: '5-55/10 8-18 * * *' },
  { cron: '0 0 29 feb *' },
  { cron: '0 0 31 jan,feb *' },
  { cron: '0 0 31 2 1' },
  { cron: '  0   7 * * *  ', timeZone: 'UTC' },
  { cron: '0 0 * JAN MON' },
];

const INVALID: readonly JobSchedule[] = [
  { every: '0m' },
  { every: '0' },
  { every: '1.5h' },
  { every: '15' + 'min' },
  { every: '-5m' },
  { every: 'soon' },
  { every: '' },
  { cron: '0 7 * *' },
  { cron: '0 7 * * * *' },
  { cron: '60 * * * *' },
  { cron: '* 24 * * *' },
  { cron: '* * 0 * *' },
  { cron: '* * * 13 *' },
  { cron: '* * * * 8' },
  { cron: '*/0 * * * *' },
  { cron: '10-5 * * * *' },
  { cron: '* * * foo *' },
  { cron: '* * * * jan' },
  { cron: '0 0 31 2 *' },
  { cron: '0 0 30 feb *' },
  { cron: '0 0 31 apr,jun *' },
  { cron: '0 7 * * 1-5', timeZone: 'Mars/Olympus' },
  { cron: '' },
];

describe('the schedule validation of the CLI, held to parseJobSchedule of the kernel', () => {
  it.each(VALID)('accepts %j, as the kernel does', (schedule) => {
    expect(kernelAccepts(schedule)).toBe(true);
    expect(jobScheduleProblem(schedule)).toBeUndefined();
  });

  it.each(INVALID)('refuses %j, as the kernel does', (schedule) => {
    expect(kernelAccepts(schedule)).toBe(false);
    expect(jobScheduleProblem(schedule)).toEqual(expect.any(String));
  });

  it('says what to write instead', () => {
    expect(jobScheduleProblem({ every: '0m' })).toContain('is not a duration');
    expect(jobScheduleProblem({ cron: '0 7 * *' })).toContain('five are expected');
    expect(jobScheduleProblem({ cron: '60 * * * *' })).toContain('is not a minute of a cron expression');
    expect(jobScheduleProblem({ cron: '0 0 31 2 *' })).toContain('never fires');
    expect(jobScheduleProblem({ cron: '0 7 * * *', timeZone: 'Mars/Olympus' })).toContain('is not a time zone');
  });

  it('writes the schedule the way the kernel reads it', () => {
    expect(writtenSchedule({ every: '15m' })).toBe("{ every: '15m' }");
    expect(writtenSchedule({ every: '900000' })).toBe('{ every: 900000 }');
    expect(writtenSchedule({ cron: ' 0  7 * * 1-5 ' })).toBe("{ cron: '0 7 * * 1-5' }");
    expect(writtenSchedule({ cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })).toBe("{ cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }");
  });
});

function kernelAccepts(schedule: JobSchedule): boolean {
  try {
    parseJobSchedule(asWritten(schedule));

    return true;
  } catch {
    return false;
  }
}

/** The schedule as the kernel receives it from the generated source: digits alone are milliseconds. */
function asWritten({ every, cron, timeZone }: JobSchedule): KernelSchedule {
  if (every !== undefined) return /^\d+$/.test(every.trim()) ? { every: Number(every) } : ({ every: every.trim() } as KernelSchedule);

  return { cron: cron ?? '', ...(timeZone === undefined ? {} : { timeZone }) };
}
