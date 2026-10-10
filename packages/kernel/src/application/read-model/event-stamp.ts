/**
 * Which event a row of a read model was last changed by. Rows are ordered by it: by `version`
 * when both stamps carry one (a counter the upstream gives per key), else by the instant the
 * event occurred, the event id deciding between two events of the same instant.
 */
export interface EventStamp {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly version?: number;
}
