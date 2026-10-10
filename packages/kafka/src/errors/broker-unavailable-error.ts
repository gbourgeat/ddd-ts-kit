/** The cluster cannot be reached, or did not answer in time. */
export class BrokerUnavailableError extends Error {
  readonly code = 'BROKER_UNAVAILABLE';

  /** `reason` is the code of what made the cluster unreachable, never a message. */
  constructor(readonly reason: string) {
    super(`The broker is unavailable (${reason})`);
    this.name = 'BrokerUnavailableError';
  }
}
