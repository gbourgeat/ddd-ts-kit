/** A worker claimed a job of its queue that no module registered: a newer version enqueued it, or it was renamed. */
export class UnknownBackgroundJobError extends Error {
  readonly code = 'UNKNOWN_BACKGROUND_JOB';

  constructor(job: string) {
    super(`No background job is named "${job}" in this worker.`);
    this.name = 'UnknownBackgroundJobError';
  }
}
