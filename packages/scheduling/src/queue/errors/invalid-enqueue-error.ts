/** What `enqueue` cannot accept: raised where the job is enqueued, before anything is stored. */
export class InvalidEnqueueError extends Error {
  readonly code = 'INVALID_ENQUEUE';

  private constructor(message: string) {
    super(message);
    this.name = 'InvalidEnqueueError';
  }

  static unnamed(jobName: string): InvalidEnqueueError {
    return new InvalidEnqueueError(
      `"${jobName}" is not a job name: the static jobName of a background job is <context>.<job-name>.`,
    );
  }

  static twoInstants(): InvalidEnqueueError {
    return new InvalidEnqueueError('A job is enqueued with a delay or a runAt, not both.');
  }
}
