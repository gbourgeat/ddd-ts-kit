import { ok, type BackgroundJobType } from '@ddd-ts-kit/kernel';

/**
 * A background job as an earlier version of the code declared it: its name, with a schema that
 * reads any payload. A spec enqueues a payload of an earlier shape through it, which `enqueue`
 * would refuse for the job of this version, and shows what the worker of this version does with
 * it: `jobs.enqueue(earlierVersionOf(ClearCalendarBackgroundJob), { calendarId: 'calendar-1' })`.
 */
export function earlierVersionOf(job: BackgroundJobType<unknown>): BackgroundJobType<unknown> {
  return { jobName: job.jobName, payload: { parse: (input) => ok(input) }, prototype: job.prototype };
}
