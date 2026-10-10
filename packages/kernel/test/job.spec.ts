import { describe, expect, it } from 'vitest';
import {
  InvalidJobScheduleError,
  describeJobSchedule,
  executionContextOfJob,
  isJobName,
  jobPolicy,
  jobScheduleOf,
  parseDuration,
  parseJobSchedule,
  type JobOptions,
  type JobSchedule,
} from '../src/index.js';
import { DeclarationError, Scheduled, declarationOf, type ScheduledOptions } from '../src/declarations.js';

/** What refuses a schedule, as the text of its error. */
function refusal(attempt: () => unknown): string {
  try {
    attempt();
  } catch (error) {
    if (error instanceof InvalidJobScheduleError && error.code === 'INVALID_JOB_SCHEDULE') {
      return error.message;
    }

    throw error;
  }

  throw new Error('Expected the schedule to be refused');
}

function cron(expression: string, timeZone?: string) {
  const parsed = parseJobSchedule({ cron: expression, ...(timeZone === undefined ? {} : { timeZone }) });

  if (parsed.kind !== 'cron') {
    throw new Error('Expected a cron');
  }

  return parsed;
}

describe('a duration', () => {
  it('is a whole number of milliseconds, or a number and a unit', () => {
    expect(parseDuration(1_500)).toBe(1_500);

    expect([
      parseDuration('250ms'),
      parseDuration('30s'),
      parseDuration('15m'),
      parseDuration('2h'),
      parseDuration('1d'),
    ]).toEqual([250, 30_000, 900_000, 7_200_000, 86_400_000]);
  });

  it.each([0, -5, 1.5, Number.NaN, '0s', '15', 'm', '1.5h', '2 weeks', '-3m', ''])(
    'is refused when it is %j',
    (written) => {
      expect(refusal(() => parseDuration(written))).toContain(
        `"${written}" is not a duration: write a positive whole number of milliseconds`,
      );
    },
  );
});

describe('a cron expression', () => {
  it('is read field by field into the values it allows', () => {
    expect(cron('*/15 8-18/5 1,15 * mon-fri', 'Europe/Paris')).toEqual({
      kind: 'cron',
      expression: '*/15 8-18/5 1,15 * mon-fri',
      timeZone: 'Europe/Paris',
      minutes: [0, 15, 30, 45],
      hours: [8, 13, 18],
      daysOfMonth: [1, 15],
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      daysOfWeek: [1, 2, 3, 4, 5],
      dayOfMonthRestricted: true,
      dayOfWeekRestricted: true,
      everyHour: false,
    });
  });

  it('defaults to UTC, ignores the case of names and extra spaces, and reads 7 as Sunday', () => {
    expect(cron('  0   */6  * JAN,Dec   SUN ')).toMatchObject({
      expression: '0 */6 * JAN,Dec SUN',
      timeZone: 'UTC',
      months: [1, 12],
      daysOfWeek: [0],
      dayOfMonthRestricted: false,
      everyHour: true,
    });

    expect(cron('0 0 * * 6-7').daysOfWeek).toEqual([0, 6]);
    expect(cron('5,5,1 0 * * *').minutes).toEqual([1, 5]);
  });

  it.each([
    ['0 7 * *', 'has 4 field(s): five are expected (minute, hour, day of month, month, day of week)'],
    ['0 0 7 * * *', 'has 6 field(s): five are expected'],
    ['60 * * * *', '"60" is not a minute of a cron expression'],
    ['* 24 * * *', '"24" is not a hour of a cron expression'],
    ['0 0 0 * *', '"0" is not a day of month of a cron expression'],
    ['0 0 * 13 *', '"13" is not a month of a cron expression'],
    ['0 0 * * 8', '"8" is not a day of week of a cron expression'],
    ['0 0 * * mon-', '"mon-" is not a day of week of a cron expression'],
    ['0 0 * foo *', '"foo" is not a month of a cron expression'],
    ['0 0 * jan *', undefined],
    ['0 0 * * jan', '"jan" is not a day of week of a cron expression'],
    ['*/0 * * * *', '"*/0" is not a minute of a cron expression'],
    ['30-10 * * * *', '"30-10" is not a minute of a cron expression'],
    ['5/15 * * * *', '"5/15" is not a minute of a cron expression'],
    ['1,,2 * * * *', '"" is not a minute of a cron expression'],
    ['@daily', 'has 1 field(s)'],
    ['? * * * *', '"?" is not a minute of a cron expression'],
  ])('"%s" is refused unless it can be read', (expression, complaint) => {
    if (complaint === undefined) {
      expect(cron(expression).months).toEqual([1]);
    } else {
      expect(refusal(() => cron(expression))).toContain(complaint);
    }
  });

  it('is refused when no date satisfies it, unless a day of week gives it one', () => {
    expect(refusal(() => cron('0 0 31 2,4 *'))).toBe(
      'Cron "0 0 31 2,4 *" never fires: none of its months has such a day.',
    );

    expect(refusal(() => cron('0 0 30 feb *'))).toContain('never fires');
    expect(cron('0 0 29 2 *').daysOfMonth).toEqual([29]);
    expect(cron('0 0 31 2 sun').daysOfWeek).toEqual([0]);
  });

  it('is refused in a time zone the runtime does not know', () => {
    expect(refusal(() => cron('0 7 * * *', 'Europe/Lutece'))).toBe(
      `"Europe/Lutece" is not a time zone this runtime knows: write an IANA name such as 'Europe/Paris'.`,
    );

    expect(cron('0 7 * * *', 'America/New_York').timeZone).toBe('America/New_York');
  });
});

describe('a schedule', () => {
  it('is an interval or a cron, and says so as a diagnostic shows it', () => {
    expect(parseJobSchedule({ every: '15m' })).toEqual({ kind: 'interval', everyMs: 900_000 });
    expect(describeJobSchedule({ every: '15m' })).toBe('every 15m');
    expect(describeJobSchedule({ every: 90_000 })).toBe('every 90000ms');

    expect(describeJobSchedule({ cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })).toBe(
      'cron 0 7 * * 1-5 (Europe/Paris)',
    );

    expect(describeJobSchedule({ cron: '0 7 * * *' })).toBe('cron 0 7 * * * (UTC)');
  });

  it('is taken out of the keys written next to other options, and refused when they are not one schedule', () => {
    const settings: ScheduledOptions = { cron: '0 7 * * *', timeZone: 'Europe/Paris', overlap: 'queue' };

    expect(jobScheduleOf(settings)).toEqual({ cron: '0 7 * * *', timeZone: 'Europe/Paris' });
    expect(jobScheduleOf({ every: '1h' })).toEqual({ every: '1h' });

    for (const written of [
      {},
      { every: '1h', cron: '0 * * * *' },
      { every: '1h', timeZone: 'UTC' },
      { timeZone: 'UTC' },
    ] as const) {
      expect(refusal(() => jobScheduleOf(written))).toBe('A schedule is either { every } or { cron, timeZone? }.');
    }
  });
});

describe('the options of a job', () => {
  it('have explicit defaults: no overlap, nothing caught up, no jitter, enabled, one instance, no timeout', () => {
    expect(jobPolicy({})).toEqual({
      overlap: 'skip',
      missed: 'skip',
      jitterMs: 0,
      enabled: true,
      singleInstance: true,
    });

    expect(
      jobPolicy({
        overlap: 'queue',
        missed: 'run-once',
        timeoutMs: 5_000,
        jitterMs: 250,
        enabled: false,
        singleInstance: false,
      }),
    ).toEqual({
      overlap: 'queue',
      missed: 'run-once',
      timeoutMs: 5_000,
      jitterMs: 250,
      enabled: false,
      singleInstance: false,
    });
  });

  it('are refused when a configuration writes what the type would not allow', () => {
    const fromConfiguration = (options: Record<string, unknown>): JobOptions => options;

    expect(refusal(() => jobPolicy(fromConfiguration({ overlap: 'parallel' })))).toBe(
      'overlap is "parallel": one of skip, queue is expected.',
    );

    expect(refusal(() => jobPolicy(fromConfiguration({ missed: 'all' })))).toBe(
      'missed is "all": one of skip, run-once is expected.',
    );

    expect(refusal(() => jobPolicy({ jitterMs: -1 }))).toContain('jitterMs is -1');
    expect(refusal(() => jobPolicy({ timeoutMs: 0 }))).toContain('"0" is not a duration');
  });
});

describe('a job name', () => {
  it('is <context>.<job-name> in lower case, words separated by dashes', () => {
    expect(['billing.send-reminders', 'billing.invoices.close-month', 'crm2.sync-contacts'].every(isJobName)).toBe(
      true,
    );

    expect(
      [
        'send-reminders',
        'Billing.sendReminders',
        'billing.',
        '.send',
        'billing..send',
        'billing.send_reminders',
        'billing.send-',
        '',
      ].some(isJobName),
    ).toBe(false);
  });
});

describe('@Scheduled', () => {
  class SendReminders {
    async run(): Promise<void> {}
  }

  const declaring = (name: `${string}.${string}`, settings: ScheduledOptions) => () => Scheduled(name, settings);
  const unchecked = (settings: Record<string, unknown>): ScheduledOptions => ({ every: '1h', ...settings });

  it('records the job without building it, and keeps the options as they were written', () => {
    Scheduled('billing.send-reminders', { every: '15m', missed: 'run-once', jitterMs: 2_000 })(SendReminders);

    expect(declarationOf(SendReminders)).toEqual({
      role: 'job',
      name: 'billing.send-reminders',
      schedule: { every: '15m' },
      options: { missed: 'run-once', jitterMs: 2_000 },
      implementation: SendReminders,
      dependencies: [],
    });
  });

  it.each<[`${string}.${string}`, ScheduledOptions, string]>([
    [
      'billing.SendReminders',
      { every: '15m' },
      '"billing.SendReminders" is not a job name: write <context>.<job-name> in lower case, words separated by dashes, as in \'billing.send-reminders\'.',
    ],
    ['billing.send-reminders', { every: 0 }, 'Job "billing.send-reminders": "0" is not a duration'],
    [
      'billing.send-reminders',
      { cron: '0 7 * * 1-8' },
      'Job "billing.send-reminders": "8" is not a day of week of a cron expression',
    ],
    [
      'billing.send-reminders',
      { cron: '0 7 * * *', timeZone: 'Mars/Olympus' },
      'Job "billing.send-reminders": "Mars/Olympus" is not a time zone',
    ],
    ['billing.send-reminders', { cron: '0 0 31 2 *' }, 'Job "billing.send-reminders": Cron "0 0 31 2 *" never fires'],
    [
      'billing.send-reminders',
      unchecked({ cron: '0 7 * * *' }),
      'Job "billing.send-reminders": A schedule is either { every } or { cron, timeZone? }.',
    ],
    ['billing.send-reminders', unchecked({ timeoutMs: -5 }), 'Job "billing.send-reminders": "-5" is not a duration'],
    [
      'billing.send-reminders',
      unchecked({ overlap: 'parallel' }),
      'Job "billing.send-reminders": overlap is "parallel"',
    ],
  ])('refuses %s with %j when the file loads', (name, settings, complaint) => {
    expect(declaring(name, settings)).toThrow(DeclarationError);
    expect(declaring(name, settings)).toThrow(complaint);
  });
});

describe('the execution context of a run', () => {
  it('has the origin schedule, the system actor of the job, and the instants it is given', () => {
    const scheduledAt = new Date('2026-03-02T10:00:00.000Z');
    const deadline = new Date('2026-03-02T10:05:00.000Z');
    const schedule: JobSchedule = { every: '15m' };

    expect(executionContextOfJob('billing.send-reminders', { correlationId: 'run-1', scheduledAt, deadline })).toEqual({
      correlationId: 'run-1',
      origin: 'schedule',
      actor: { id: 'system:billing.send-reminders', type: 'system', roles: [], attributes: {} },
      scheduledAt,
      deadline,
      extensions: {},
    });

    expect(executionContextOfJob('billing.send-reminders', { correlationId: 'run-2', scheduledAt })).not.toHaveProperty(
      'deadline',
    );

    expect(parseJobSchedule(schedule).kind).toBe('interval');
  });
});
