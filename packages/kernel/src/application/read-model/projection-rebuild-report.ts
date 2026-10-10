export interface ProjectionRebuildReport {
  /** Rows the export gave. */
  readonly copied: number;
  /** Keys read again because an event wrote them while the rebuild ran. */
  readonly reread: number;
  /** Rounds of reading again before the swap. */
  readonly rounds: number;
}
