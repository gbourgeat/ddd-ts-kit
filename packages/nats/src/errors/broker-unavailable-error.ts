/** No live connection: the first one failed, or a reconnection is pending. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the server unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The broker is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}
