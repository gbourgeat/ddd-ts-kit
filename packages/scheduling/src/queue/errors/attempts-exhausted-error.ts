/** A job claimed again after its last attempt: its worker died, or lost its lease, during that attempt. */
export class AttemptsExhaustedError extends Error {
  readonly code = 'ATTEMPTS_EXHAUSTED';

  constructor(job: string, maxAttempts: number) {
    super(`Background job "${job}" used its ${maxAttempts} attempt(s).`);
    this.name = 'AttemptsExhaustedError';
  }
}
