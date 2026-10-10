import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { one } from './one.js';
import { PROVIDED_BROKERS } from './provided-brokers.js';

interface BrokerAddress {
  readonly variable: string;
  readonly key: string;
  readonly absent: string;
  readonly reader: string;
}

/** How the platform reaches a broker that has an address of its own: its environment variable, its key in the validated config, and what stands for "no broker" in the tests. */
const BROKER_ADDRESS: Readonly<Record<string, BrokerAddress>> = {
  rabbitmq: { variable: 'AMQP_URL', key: 'amqpUrl', absent: 'amqp://in-process/tests', reader: 'readUrl' },
  // A list of `host:port`, which is not a URL.
  kafka: { variable: 'KAFKA_BROKERS', key: 'kafkaBrokers', absent: 'in-process:0', reader: 'readText' },
  nats: { variable: 'NATS_URL', key: 'natsUrl', absent: 'nats://in-process/tests', reader: 'readUrl' },
};

export function brokerVars(config: Config): RenderContext {
  const { broker } = config.stack;
  const address = BROKER_ADDRESS[broker];

  return {
    ...one(broker, ['none', 'rabbitmq', 'kafka', 'nats', 'redis', 'custom']),
    external: broker !== 'none',
    provided: PROVIDED_BROKERS.includes(broker),
    name: broker,
    // Redis Streams run on the Redis protocol server of the platform, behind REDIS_URL like the cache.
    addressed: address !== undefined,
    variable: address?.variable ?? '',
    key: address?.key ?? '',
    absent: address?.absent ?? '',
    reader: address?.reader ?? '',
    inProcessWhen: inProcessTest(broker, address?.key),
  };
}

/** What the end-to-end support of a project tests to keep its events in the process: the address of the broker was not given. */
function inProcessTest(broker: string, key: string | undefined): string {
  if (broker === 'redis') return 'config.redisUrl === noRedis';

  return key === undefined ? '' : `config.${key} === noBroker`;
}
