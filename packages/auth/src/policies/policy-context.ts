export interface PolicyContext {
  /** From the `Clock` port, so a rule about time is testable. */
  readonly now: Date;
}
