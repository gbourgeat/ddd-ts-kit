/**
 * The stream did not acknowledge the message in time: it may or may not hold it. Publish
 * again; inside the duplicate window the stream drops the second copy.
 */
export class PublishNotAcknowledgedError extends Error {
  readonly code = 'PUBLISH_NOT_ACKNOWLEDGED';

  constructor(
    readonly eventId: string,
    readonly reason: string,
  ) {
    super(`The stream did not acknowledge event ${eventId} (${reason})`);
    this.name = 'PublishNotAcknowledgedError';
  }
}
