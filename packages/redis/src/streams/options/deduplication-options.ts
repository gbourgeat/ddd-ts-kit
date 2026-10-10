export interface DeduplicationOptions {
  /** How long the id of a published event is remembered. A relay retry within it appends nothing. */
  readonly windowMs: number;
}
