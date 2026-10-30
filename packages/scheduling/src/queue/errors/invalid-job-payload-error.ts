import type { PayloadIssue } from '@ddd-ts-kit/kernel';
import type { ClaimedJob } from '../store/claimed-job';
import { faultsOf, type PayloadFault } from './faults-of';

/**
 * The payload the queue kept for a job does not fit the schema of that job: it was enqueued
 * before a deploy that changed its shape, or written by hand. The job is not run and is dead at
 * once, since no attempt would read it better: an operator retries it once a version that reads
 * it is deployed, or cancels it. It carries the path and the code of each issue and never their
 * message, which may quote the stored data: it reaches the log, the observer and the error
 * reporter whole.
 */
export class InvalidJobPayloadError extends Error {
  readonly code = 'INVALID_JOB_PAYLOAD';

  readonly job: string;

  readonly jobId: string;

  readonly issues: readonly PayloadFault[];

  constructor(job: Pick<ClaimedJob, 'name' | 'id'>, issues: readonly PayloadIssue[]) {
    const faults = faultsOf(issues);
    const summary = faults.map((fault) => `${fault.path || '(payload)'}: ${fault.code}`).join(', ');

    super(
      `Background job "${job.name}" (job ${job.id}) was not run: its stored payload does not fit its schema (${summary}).`,
    );

    this.name = 'InvalidJobPayloadError';
    this.job = job.name;
    this.jobId = job.id;
    this.issues = faults;
  }
}
