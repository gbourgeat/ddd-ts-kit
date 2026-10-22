import type { ChannelModel } from 'amqplib';
import type { QueueType } from './queue-type';
import type { RabbitMqDelivery } from './rabbit-mq-delivery';
import type { RabbitMqFailure } from './rabbit-mq-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';

/** The options of a bus with every default applied. */
export interface Settings {
  readonly open: () => Promise<ChannelModel>;
  readonly exchange: string;
  readonly consumer: string | undefined;
  readonly prefetch: number;
  readonly queueType: QueueType;
  readonly failOnUnroutable: boolean;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: RabbitMqFailure) => void;
  readonly onDelivery: (delivery: RabbitMqDelivery) => void;
}
