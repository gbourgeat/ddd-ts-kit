import type { Channel } from 'amqplib';
import type { QueueType } from './options.js';

export interface ExchangeDescription {
  readonly name: string;
  readonly type: 'topic';
  readonly durable: true;
}

export interface QueueDescription {
  readonly name: string;
  /** `work` is consumed, `retry` holds a failed message for the delay, `dead` keeps it. */
  readonly role: 'work' | 'retry' | 'dead';
  readonly durable: true;
  readonly arguments: Readonly<Record<string, string | number>>;
}

export interface BindingDescription {
  readonly exchange: string;
  readonly queue: string;
  readonly routingKey: string;
}

/** Everything the bus declares on the broker, as data: for documentation and reviews. */
export interface RabbitMqTopology {
  readonly exchanges: readonly ExchangeDescription[];
  readonly queues: readonly QueueDescription[];
  readonly bindings: readonly BindingDescription[];
}

export interface QueueNames {
  readonly work: string;
  readonly retry: string;
  readonly dead: string;
}

export interface ConsumerBinding {
  readonly consumer: string;
  readonly type: string;
}

export interface TopologySettings {
  readonly exchange: string;
  readonly queueType: QueueType;
  readonly retryDelayMs: number;
}

export function queueNamesOf({ consumer, type }: ConsumerBinding): QueueNames {
  const work = `${consumer}.${type}`;
  return { work, retry: `${work}.retry`, dead: `${work}.dead` };
}

export function topologyOf(
  settings: TopologySettings,
  bindings: readonly ConsumerBinding[],
): RabbitMqTopology {
  return {
    exchanges: [{ name: settings.exchange, type: 'topic', durable: true }],
    queues: bindings.flatMap((binding) => queuesOf(settings, queueNamesOf(binding))),
    bindings: bindings.map((binding) => ({
      exchange: settings.exchange,
      queue: queueNamesOf(binding).work,
      routingKey: binding.type,
    })),
  };
}

/** Idempotent: declaring what already exists with the same arguments changes nothing. */
export async function declareTopology(channel: Channel, topology: RabbitMqTopology): Promise<void> {
  for (const exchange of topology.exchanges) {
    await channel.assertExchange(exchange.name, exchange.type, { durable: exchange.durable });
  }
  for (const queue of topology.queues) {
    await channel.assertQueue(queue.name, { durable: queue.durable, arguments: queue.arguments });
  }
  for (const binding of topology.bindings) {
    await channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
  }
}

// The default exchange ('') routes to the queue named by the routing key: retries and dead
// letters reach their queue without an exchange or a binding of their own.
const DEFAULT_EXCHANGE_OF_THE_BROKER = '';

function queuesOf(settings: TopologySettings, names: QueueNames): QueueDescription[] {
  const type = { 'x-queue-type': settings.queueType };
  return [
    {
      name: names.work,
      role: 'work',
      durable: true,
      arguments: { ...type, ...deadLetteringTo(names.dead) },
    },
    {
      name: names.retry,
      role: 'retry',
      durable: true,
      arguments: {
        ...type,
        'x-message-ttl': settings.retryDelayMs,
        ...deadLetteringTo(names.work),
        ...lossless(settings.queueType),
      },
    },
    { name: names.dead, role: 'dead', durable: true, arguments: type },
  ];
}

function deadLetteringTo(queue: string): Record<string, string> {
  return {
    'x-dead-letter-exchange': DEFAULT_EXCHANGE_OF_THE_BROKER,
    'x-dead-letter-routing-key': queue,
  };
}

// A quorum queue dead-letters at most once unless told otherwise: an expired retry must not
// be lost on its way back. The strategy requires the overflow policy that goes with it.
function lossless(queueType: QueueType): Record<string, string> {
  return queueType === 'quorum'
    ? { 'x-dead-letter-strategy': 'at-least-once', 'x-overflow': 'reject-publish' }
    : {};
}
