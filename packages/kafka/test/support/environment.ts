/** Set it to run these suites: `127.0.0.1:9092`. */
export const KAFKA_BROKERS = process.env['DDD_TS_KIT_TEST_KAFKA_BROKERS'];

/**
 * Set it to run the network failure tests too: `<relayed listener>=<broker port behind it>`,
 * for example `127.0.0.1:9095=127.0.0.1:9094`. The broker advertises the first address on a
 * second listener; the tests listen there and relay to the second.
 */
export const KAFKA_RELAY = process.env['DDD_TS_KIT_TEST_KAFKA_RELAY'];

export const RETRY_DELAY_MS = 60;

export const MAX_ATTEMPTS = 3;
