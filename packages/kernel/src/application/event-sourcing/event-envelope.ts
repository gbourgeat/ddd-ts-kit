/** What a stored event says besides its data, handed to `decode` to build the domain event back. */
export interface EventEnvelope {
  readonly id: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  /** Its rank in its stream. */
  readonly version: number;
}
