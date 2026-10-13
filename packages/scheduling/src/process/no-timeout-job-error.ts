/** A process armed a timeout and names no background job to deliver it. */
export class NoTimeoutJobError extends Error {
  readonly code = 'NO_TIMEOUT_JOB';

  constructor(process: string) {
    super(
      `Process "${process}" arms a timeout and has no static timeoutJob: name the background job that delivers it.`,
    );

    this.name = 'NoTimeoutJobError';
  }
}
