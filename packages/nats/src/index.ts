export { NatsEventBus } from './nats-event-bus.js';
export { DEFAULT_STREAM, DEFAULT_SUBJECT_PREFIX } from './options/nats-event-bus-options.js';
export type { NatsEventBusOptions } from './options/nats-event-bus-options.js';
export type { NatsDelivery } from './options/nats-delivery.js';
export type { NatsFailure } from './options/nats-failure.js';
export type { ReconnectOptions } from './options/reconnect-options.js';
export type { RetryOptions } from './options/retry-options.js';
export type { StreamStorage } from './options/stream-storage.js';
export { bindingNamesOf } from './topology/binding-names-of.js';
export { deadStreamOf } from './topology/dead-stream-of.js';
export type { BindingNames } from './topology/binding-names.js';
export type { ConsumerBinding } from './topology/consumer-binding.js';
export type { ConsumerDescription } from './topology/consumer-description.js';
export type { NatsTopology } from './topology/nats-topology.js';
export type { StreamDescription } from './topology/stream-description.js';
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
} from './codec/headers.js';
export { POISON_MESSAGE } from './consumption/poison-message.js';
export { BrokerUnavailableError } from './errors/broker-unavailable-error.js';
export { ConsumerNameRequiredError } from './errors/consumer-name-required-error.js';
export { EventBusClosedError } from './errors/event-bus-closed-error.js';
export { PublishNotAcknowledgedError } from './errors/publish-not-acknowledged-error.js';
