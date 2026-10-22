import { Broker } from './broker';
import { KAFKA_BROKERS, KAFKA_RELAY } from './environment';

type BrokerRow = readonly [name: string, connect: () => Promise<Broker>];

const brokers = KAFKA_BROKERS;

const real: readonly BrokerRow[] = brokers === undefined ? [] : [['on Kafka', () => Broker.connect(brokers)]];

const inMemory: BrokerRow = ['in memory', () => Broker.inMemory()];

/**
 * The clusters a suite of the bus runs on: the in-memory one always, a real Kafka when
 * `DDD_TS_KIT_TEST_KAFKA_BROKERS` names one. As `[name, connect]` rows for `describe.each`.
 */
export const BROKERS: readonly BrokerRow[] = [inMemory, ...real];

/** The same, where the network can be sabotaged: a real Kafka needs `DDD_TS_KIT_TEST_KAFKA_RELAY` too. */
export const NETWORKED_BROKERS: readonly BrokerRow[] = [inMemory, ...(KAFKA_RELAY === undefined ? [] : real)];
