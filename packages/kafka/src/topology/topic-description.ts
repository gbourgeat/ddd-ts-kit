export interface TopicDescription {
  readonly name: string;
  /** `events` carries the events of one or several types, `dead` keeps what a consumer gave up on. */
  readonly role: 'events' | 'dead';
  /** -1: the default of the broker. */
  readonly partitions: number;
  /** -1: the default of the broker. */
  readonly replicationFactor: number;
}
