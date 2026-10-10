export { RabbitMqEventBus } from './rabbit-mq-event-bus.js';
export { DEFAULT_EXCHANGE } from './options/rabbit-mq-event-bus-options.js';
export type { RabbitMqEventBusOptions } from './options/rabbit-mq-event-bus-options.js';
export type { QueueType } from './options/queue-type.js';
export type { RabbitMqDelivery } from './options/rabbit-mq-delivery.js';
export type { RabbitMqFailure } from './options/rabbit-mq-failure.js';
export type { ReconnectOptions } from './options/reconnect-options.js';
export type { RetryOptions } from './options/retry-options.js';
export { queueNamesOf } from './topology/queue-names-of.js';
export type { BindingDescription } from './topology/binding-description.js';
export type { ConsumerBinding } from './topology/consumer-binding.js';
export type { ExchangeDescription } from './topology/exchange-description.js';
export type { QueueDescription } from './topology/queue-description.js';
export type { QueueNames } from './topology/queue-names.js';
export type { RabbitMqTopology } from './topology/rabbit-mq-topology.js';
export {
  ATTEMPT_HEADER,
  CORRELATION_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  EVENT_VERSION_HEADER,
  TRACEPARENT_HEADER,
} from './codec/headers.js';
export { POISON_MESSAGE } from './consumption/poison-message.js';
export { BrokerUnavailableError } from './errors/broker-unavailable-error.js';
export { ConsumerNameRequiredError } from './errors/consumer-name-required-error.js';
export { EventBusClosedError } from './errors/event-bus-closed-error.js';
export { PublishNotConfirmedError } from './errors/publish-not-confirmed-error.js';
export { UnroutableEventError } from './errors/unroutable-event-error.js';
