import { jobScheduleOf, type ScheduledJob } from '@ddd-ts-kit/kernel';
import type { ScheduledOptions, Token } from '@ddd-ts-kit/kernel/declarations';
import type { JobRegistration } from '../wiring/job-registration';
import { readable } from './readable';

interface Located {
  readonly module: string;
  readonly job: Token<ScheduledJob>;
}

/** The job of an explicit module: `builder.job('billing.send-reminders', { every: '15m' })`. */
export function writtenJob(name: string, settings: ScheduledOptions, located: Located): JobRegistration {
  const { every: _every, cron: _cron, timeZone: _timeZone, ...options } = settings;

  return { name, schedule: readable(name, () => jobScheduleOf(settings)), options, ...located };
}
