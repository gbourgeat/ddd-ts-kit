/** One message settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface RabbitMqDelivery {
  readonly queue: string;
  /** Which delivery of the message this was, starting at 1. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved. `retried`: sent to wait for another delivery.
   * `dead`: attempts spent, moved to the dead queue. `poison`: not an envelope, moved there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}
