import type { ChannelModel, Options } from 'amqplib';
import type { QueueType } from './queue-type';
import type { RabbitMqDelivery } from './rabbit-mq-delivery';
import type { RabbitMqFailure } from './rabbit-mq-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';

export const DEFAULT_EXCHANGE = 'integration-events';

export interface RabbitMqEventBusOptions {
  /**
   * An AMQP URL, amqplib connection options, or a factory opening a NEW connection each time
   * it is called (TLS, rotating credentials). The bus owns what it opens and closes it.
   */
  readonly connection: string | Options.Connect | (() => Promise<ChannelModel>);
  /** The durable topic exchange events are published to. Default `integration-events`. */
  readonly exchange?: string;
  /** The consuming context `subscribe` declares its queues for. See also `forConsumer`. */
  readonly consumer?: string;
  /** Unacknowledged messages a queue hands to this bus at once. Default 10. */
  readonly prefetch?: number;
  /** Default `quorum`. */
  readonly queueType?: QueueType;
  /** What `publish` does with an event no queue is bound for. Default `ignore`. */
  readonly onUnroutable?: 'ignore' | 'fail';
  readonly retry?: RetryOptions;
  readonly reconnect?: ReconnectOptions;
  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: RabbitMqFailure) => void;
  /** Metrics hook, called once per message a consumer settles, before it is acknowledged. */
  readonly onDelivery?: (delivery: RabbitMqDelivery) => void;
}
