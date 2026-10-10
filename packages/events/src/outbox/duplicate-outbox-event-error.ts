export class DuplicateOutboxEventError extends Error {
  readonly code = 'DUPLICATE_OUTBOX_EVENT';

  constructor(eventId: string) {
    super(`Event ${eventId} is already in the outbox`);
    this.name = 'DuplicateOutboxEventError';
  }
}
