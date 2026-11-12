/**
 * Which event a row of a read model was last changed by. Rows are ordered by it: by `version`
 * when the stamps carry one (a counter the upstream gives per key), else by the instant the
 * event occurred, the event id deciding between two events of the same instant. The stamps of
 * one key should all carry a version, or none: between one of each, the instants decide, and the
 * order of three such stamps may depend on the order they are compared in.
 */
export interface EventStamp {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly version?: number;
}
