/** An event of the subscribed type and version that its contract refuses. */
export class UnreadableEventError extends Error {
  readonly code = 'UNREADABLE_EVENT';

  constructor(
    readonly eventType: string,
    readonly eventVersion: number,
    readonly reason: string,
  ) {
    super(`Cannot read ${eventType} v${eventVersion}: ${reason}`);
    this.name = 'UnreadableEventError';
  }
}
