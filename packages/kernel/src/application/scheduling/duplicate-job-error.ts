export class DuplicateJobError extends Error {
  readonly code = 'DUPLICATE_JOB';

  constructor(readonly job: string) {
    super(`A job named "${job}" is already registered: a job name is unique in an application.`);
    this.name = 'DuplicateJobError';
  }
}
