export interface ErrorDescription {
  /** The class name of the error. */
  readonly errorType: string;
  /** The `code` of a `DomainError`, or of a fault that carries a short one (`TIMEOUT`, `ECONNRESET`). */
  readonly errorCode?: string;
}
