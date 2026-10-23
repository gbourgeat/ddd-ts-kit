import { Broker } from './broker';
import { NATS_URL } from './environment';

type BrokerRow = readonly [name: string, connect: () => Promise<Broker>];

const url = NATS_URL;

const real: readonly BrokerRow[] = url === undefined ? [] : [['on nats-server', () => Broker.connect(url)]];

/**
 * The servers a suite of the bus runs on: the in-memory one always, a real nats-server when
 * `DDD_TS_KIT_TEST_NATS_URL` names one. As `[name, connect]` rows for `describe.each`.
 */
export const BROKERS: readonly BrokerRow[] = [['in memory', () => Broker.inMemory()], ...real];
