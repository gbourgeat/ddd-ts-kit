/** One entry settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface RedisStreamsDelivery {
  readonly stream: string;

  readonly consumer: string;

  /** Which delivery of the entry this was, starting at 1: the delivery counter of the pending entry list. */
  readonly attempt: number;

  /**
   * `acknowledged`: every handler resolved. `retried`: left pending for another delivery.
   * `dead`: attempts spent, moved to the dead stream. `poison`: not an envelope, moved there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}
