import type { Channel } from 'amqplib';
import type { RabbitMqTopology } from './rabbit-mq-topology.js';

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
