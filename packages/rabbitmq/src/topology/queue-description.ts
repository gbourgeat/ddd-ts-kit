export interface QueueDescription {
  readonly name: string;
  /** `work` is consumed, `retry` holds a failed message for the delay, `dead` keeps it. */
  readonly role: 'work' | 'retry' | 'dead';
  readonly durable: true;
  readonly arguments: Readonly<Record<string, string | number>>;
}
