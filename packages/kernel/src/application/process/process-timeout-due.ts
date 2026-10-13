/** What the timeout job of a process is enqueued with, and runs the step with. */
export interface ProcessTimeoutDue {
  readonly id: string;
  readonly timeout: string;
}
