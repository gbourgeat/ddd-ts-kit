import { Broker } from './broker';
import { AMQP_URL } from './environment';

type BrokerRow = readonly [name: string, connect: () => Promise<Broker>];

const url = AMQP_URL;

const real: readonly BrokerRow[] = url === undefined ? [] : [['on RabbitMQ', () => Broker.connect(url)]];

/**
 * The brokers a suite of the bus runs on: the in-memory one always, a real RabbitMQ when
 * `DDD_TS_KIT_TEST_AMQP_URL` names one. As `[name, connect]` rows for `describe.each`.
 */
export const BROKERS: readonly BrokerRow[] = [['in memory', () => Broker.inMemory()], ...real];
