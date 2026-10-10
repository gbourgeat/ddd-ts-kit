export interface ConsumerDescription {
  readonly stream: string;
  /** The durable name. */
  readonly name: string;
  readonly filterSubject: string;
  readonly ackWaitMs: number;
  readonly maxDeliver: number;
}
