import type { QueueType } from '../options/queue-type.js';
import type { ConsumerBinding } from './consumer-binding.js';
import type { QueueDescription } from './queue-description.js';
import type { QueueNames } from './queue-names.js';
import { queueNamesOf } from './queue-names-of.js';
import type { RabbitMqTopology } from './rabbit-mq-topology.js';
import type { TopologySettings } from './topology-settings.js';

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): RabbitMqTopology {
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
  return queueType === 'quorum' ? { 'x-dead-letter-strategy': 'at-least-once', 'x-overflow': 'reject-publish' } : {};
}
