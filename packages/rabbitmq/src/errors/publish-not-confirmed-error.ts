/** The broker did not confirm the message: it may or may not have it. Publish again. */
export class PublishNotConfirmedError extends Error {
  readonly code = 'PUBLISH_NOT_CONFIRMED';

  constructor(readonly eventId: string) {
    super(`The broker did not confirm event ${eventId}`);
    this.name = 'PublishNotConfirmedError';
  }
}
