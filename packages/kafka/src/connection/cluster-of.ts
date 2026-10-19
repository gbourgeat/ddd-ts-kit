import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { KafkaEventBusOptions } from '../options/kafka-event-bus-options.js';

/**
 * The factory of the clients of a bus: the one the options give, or one made of the brokers and
 * the client properties. The librdkafka properties carry the SASL password and the TLS keys: they
 * go to the client library here, and the bus keeps them nowhere.
 */
export function clusterOf({
  brokers,
  client,
  cluster,
}: Pick<KafkaEventBusOptions, 'brokers' | 'client' | 'cluster'>): KafkaJS.Kafka {
  if (cluster !== undefined) {
    return cluster;
  }

  // The client logs the message and the stack of what it catches: its logs stay off, and
  // failures are reported through `onFailure`, by code.
  const quiet = { brokers: brokersOf(brokers), logLevel: KafkaJS.logLevel.NOTHING };

  return new KafkaJS.Kafka({ ...client, kafkaJS: quiet });
}

function brokersOf(brokers: string | readonly string[]): string[] {
  const listed = typeof brokers === 'string' ? brokers.split(',') : [...brokers];

  return listed.map((broker) => broker.trim()).filter((broker) => broker.length > 0);
}
