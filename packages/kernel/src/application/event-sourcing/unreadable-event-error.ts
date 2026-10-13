/** A stored event, or a snapshot, that cannot be read as its declaration says: a field missing or of another type, a version without upcaster. */
export class UnreadableEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreadableEventError';
  }
}
