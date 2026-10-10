/** The two fields the kit itself logs and measures about a caught error. */
export interface ErrorIdentity {
  /** The class name of the error. */
  readonly errorType: string;
  /** The `code` of a `DomainError`, or of a fault that carries a short one (`TIMEOUT`, `ECONNRESET`). */
  readonly errorCode?: string;
}
