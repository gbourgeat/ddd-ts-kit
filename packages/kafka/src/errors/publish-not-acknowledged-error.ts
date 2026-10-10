/**
 * The in-sync replicas did not acknowledge the records in time: they may or may not be in
 * the log. Publish again; consumers deduplicate on the event id.
 */
export class PublishNotAcknowledgedError extends Error {
  readonly code = 'PUBLISH_NOT_ACKNOWLEDGED';

  constructor(
    /** The events of the send that failed; some of them may have been written. */
    readonly eventIds: readonly string[],
    readonly reason: string,
  ) {
    super(`The broker did not acknowledge ${String(eventIds.length)} event(s) (${reason})`);
    this.name = 'PublishNotAcknowledgedError';
  }
}
