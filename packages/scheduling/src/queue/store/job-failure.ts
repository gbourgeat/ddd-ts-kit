export interface JobFailure {
  /** The `code` of what the run threw, never a message. */
  readonly errorCode: string;
  /** When to try again, or `null` to declare the job dead. */
  readonly retryAt: Date | null;
  readonly at: Date;
}
