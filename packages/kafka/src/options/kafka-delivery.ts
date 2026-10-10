/** One record settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface KafkaDelivery {
  readonly consumer: string;
  readonly topic: string;
  readonly partition: number;
  /** Which delivery of the record this was, starting at 1. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved, the offset is committed next. `retried`: the
   * partition is paused for the delay, then the record is read again. `dead`: attempts spent,
   * copied to the dead-letter topic. `poison`: not an envelope, copied there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}
