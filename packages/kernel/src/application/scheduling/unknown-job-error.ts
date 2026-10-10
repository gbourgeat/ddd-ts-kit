export class UnknownJobError extends Error {
  readonly code = 'UNKNOWN_JOB';

  constructor(readonly job: string) {
    super(`No job is named "${job}".`);
    this.name = 'UnknownJobError';
  }
}
