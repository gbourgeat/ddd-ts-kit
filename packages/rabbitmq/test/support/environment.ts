/** Set it to run these suites: `amqp://user:password@127.0.0.1:5672`. */
export const AMQP_URL = process.env['DDD_TS_KIT_TEST_AMQP_URL'];

export const RETRY_DELAY_MS = 60;

export const MAX_ATTEMPTS = 3;
