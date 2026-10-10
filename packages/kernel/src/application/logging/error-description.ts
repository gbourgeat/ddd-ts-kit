/** What a log entry keeps of an error: plain data, the same from every logger of the port. */
export type ErrorDescription = {
  /** The class name of the error. */
  readonly type: string;
  /** The stable `code` of a `DomainError`. */
  readonly code?: string;
  /** `SCRUBBED_MESSAGE` when the logger scrubs and the error is unexpected. */
  readonly message: string;
  /** The stack of this error alone: its cause carries its own. */
  readonly stack?: string;
  readonly cause?: ErrorDescription;
};
