/** Set it to run these suites: `nats://127.0.0.1:4222`, a server started with `-js`. */
export const NATS_URL = process.env['DDD_TS_KIT_TEST_NATS_URL'];

export const RETRY_DELAY_MS = 60;

export const MAX_ATTEMPTS = 3;
