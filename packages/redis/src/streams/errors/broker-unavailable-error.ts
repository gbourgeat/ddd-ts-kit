/** No live connection: the first one failed, or ioredis is between two reconnection attempts. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the server unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The server is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}
