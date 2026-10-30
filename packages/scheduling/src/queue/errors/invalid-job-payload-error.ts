import type { PayloadIssue } from '@ddd-ts-kit/kernel';
import type { ClaimedJob } from '../store/claimed-job';

/**
 * The payload the queue kept for a job does not fit the schema of that job: it was enqueued
 * before a deploy that changed its shape, or written by hand. The job is not run and is dead at
 * once, since no attempt would read it better: an operator retries it once a version that reads
 * it is deployed, or cancels it.
 */
export class InvalidJobPayloadError extends Error {
  readonly code = 'INVALID_JOB_PAYLOAD';

  readonly job: string;

  readonly jobId: string;

  readonly issues: readonly PayloadIssue[];

  constructor(job: Pick<ClaimedJob, 'name' | 'id'>, issues: readonly PayloadIssue[]) {
    // Paths and codes only: the message of an issue may quote the stored data.
    const summary = issues.map((issue) => `${issue.path || '(payload)'}: ${issue.code}`).join(', ');

    super(
      `Background job "${job.name}" (job ${job.id}) was not run: its stored payload does not fit its schema (${summary}).`,
    );

    this.name = 'InvalidJobPayloadError';
    this.job = job.name;
    this.jobId = job.id;
    this.issues = issues;
  }
}
