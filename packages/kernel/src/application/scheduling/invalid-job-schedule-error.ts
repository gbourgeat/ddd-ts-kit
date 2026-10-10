/** A schedule that cannot be read or would never fire. Raised where the schedule is written. */
export class InvalidJobScheduleError extends Error {
  readonly code = 'INVALID_JOB_SCHEDULE';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobScheduleError';
  }
}
