import type { JobQueue } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { ClearCalendarBackgroundJob } from '@/contexts/scheduling/application/calendars/background/clear-calendar.background-job';
import { GetClearanceQuery } from '@/contexts/scheduling/application/calendars/queries/get-clearance/get-clearance.query';
import type { GetClearanceResult } from '@/contexts/scheduling/application/calendars/queries/get-clearance/get-clearance.result';
import { UnknownClearance } from '@/contexts/scheduling/domain/calendars/errors/unknown-clearance.error';

/**
 * Read from the queue, which keeps the progress of the job and never its payload: the subject of
 * the job ties the clearance to its calendar, so a clearance of another calendar, or of another
 * tenant, is unknown here, whoever knows its identifier.
 */
@QueryHandler(GetClearanceQuery)
export class GetClearanceHandler implements QueryHandler<GetClearanceQuery> {
  constructor(private readonly jobs: JobQueue) {}

  async execute(query: GetClearanceQuery): Promise<GetClearanceResult> {
    const job = await this.jobs.find(query.clearanceId);

    if (job?.name !== ClearCalendarBackgroundJob.jobName || job.subject !== query.calendarId) {
      throw UnknownClearance.forClearance(query.clearanceId);
    }

    const { id, status, attempts, progress, lastErrorCode } = job;

    return {
      clearanceId: id,
      status,
      attempts,
      done: progress?.done ?? 0,
      ...(progress?.total === undefined ? {} : { total: progress.total }),
      ...(lastErrorCode === undefined ? {} : { lastErrorCode }),
    };
  }
}
