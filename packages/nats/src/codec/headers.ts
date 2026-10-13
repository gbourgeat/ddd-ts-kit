/** The header the stream deduplicates on: the event id. */
export const MESSAGE_ID_HEADER = 'Nats-Msg-Id';
export const EVENT_TYPE_HEADER = 'x-event-type';
export const EVENT_VERSION_HEADER = 'x-event-version';
export const TRACEPARENT_HEADER = 'traceparent';
export const CORRELATION_HEADER = 'x-correlation-id';
export const TENANT_HEADER = 'x-tenant-id';
export const ATTEMPT_HEADER = 'x-attempt';
export const ERROR_CODE_HEADER = 'x-error-code';
export const DEAD_REASON_HEADER = 'x-dead-reason';
/** Where a dead message came from: `<stream>/<sequence>`. */
export const SOURCE_HEADER = 'x-source';
/** Set on a replayed message: the one durable consumer it is meant for. The others skip it. */
export const REPLAY_FOR_HEADER = 'x-replay-for';
