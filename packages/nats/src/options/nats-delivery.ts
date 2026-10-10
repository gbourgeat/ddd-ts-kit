/** One message settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface NatsDelivery {
  /** The durable consumer the message was delivered to. */
  readonly consumer: string;
  /** Which delivery of the message this was, starting at 1: the delivery count of the server. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved. `retried`: refused with a delay, the server
   * delivers it again. `dead`: attempts spent, copied to the dead-letter stream and
   * terminated. `poison`: not an envelope, copied there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}
