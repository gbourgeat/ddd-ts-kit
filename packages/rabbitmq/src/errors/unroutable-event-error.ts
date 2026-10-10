/** Raised under `onUnroutable: 'fail'` when no queue is bound for the type of the event. */
export class UnroutableEventError extends Error {
  readonly code = 'UNROUTABLE_EVENT';

  constructor(
    readonly eventId: string,
    readonly eventType: string,
  ) {
    super(`No queue is bound for ${eventType}: event ${eventId} was returned by the broker`);
    this.name = 'UnroutableEventError';
  }
}
