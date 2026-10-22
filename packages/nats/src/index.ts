export { NatsEventBus } from './nats-event-bus';
export { DEFAULT_STREAM, DEFAULT_SUBJECT_PREFIX } from './options/nats-event-bus-options';
export type { NatsEventBusOptions } from './options/nats-event-bus-options';
export type { NatsDelivery } from './options/nats-delivery';
export type { NatsFailure } from './options/nats-failure';
export type { ReconnectOptions } from './options/reconnect-options';
export type { RetryOptions } from './options/retry-options';
export type { StreamStorage } from './options/stream-storage';
export { bindingNamesOf } from './topology/binding-names-of';
export { deadStreamOf } from './topology/dead-stream-of';
export type { BindingNames } from './topology/binding-names';
export type { ConsumerBinding } from './topology/consumer-binding';
export type { ConsumerDescription } from './topology/consumer-description';
export type { NatsTopology } from './topology/nats-topology';
export type { StreamDescription } from './topology/stream-description';
export {
  ATTEMPT_HEADER,
  CORRELATION_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  EVENT_TYPE_HEADER,
  EVENT_VERSION_HEADER,
  MESSAGE_ID_HEADER,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
  TRACEPARENT_HEADER,
} from './codec/headers';
export { POISON_MESSAGE } from './consumption/poison-message';
export { BrokerUnavailableError } from './errors/broker-unavailable-error';
export { ConsumerNameRequiredError } from './errors/consumer-name-required-error';
export { EventBusClosedError } from './errors/event-bus-closed-error';
export { PublishNotAcknowledgedError } from './errors/publish-not-acknowledged-error';
