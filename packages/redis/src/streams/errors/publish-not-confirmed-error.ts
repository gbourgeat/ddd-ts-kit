/** The server did not acknowledge the entry: it may or may not hold it. Publish again. */
export class PublishNotConfirmedError extends Error {
  readonly code = 'PUBLISH_NOT_CONFIRMED';

  /** `reason` is the code of the failure: a transport error, or the kind of error the server answered. */
  constructor(
    readonly eventId: string,
    readonly reason: string,
  ) {
    super(`The server did not acknowledge event ${eventId} (${reason})`);
    this.name = 'PublishNotConfirmedError';
  }
}
