import { authEnvironment } from '$test/e2e/support/auth-environment';

/** Without REDIS_URL (`npm run infra:up` gives one) what lives on the Redis protocol server stays in the memory of the process: the same ports, no server. */
export const noRedis = 'redis://in-process/tests';

type Variables = Readonly<Record<string, string | undefined>>;

/** The environment of an application under test: a free port, the settings of the test credentials, and what stands for an absent server. */
export function testEnvironment(overrides: Variables = {}): Variables {
  return {
    ...process.env,
    ...authEnvironment,
    NODE_ENV: 'test',
    PORT: '0',
    REDIS_URL: (process.env['REDIS_URL'] ?? '') || noRedis,
    // The relay of the tests purges the cache of the spec, or Varnish when VARNISH_URL names one: the address only has to be one.
    VARNISH_URL: (process.env['VARNISH_URL'] ?? '') || 'http://varnish.e2e.test',
    VARNISH_PURGE_KEY: (process.env['VARNISH_PURGE_KEY'] ?? '') || 'e2e-purge-key',
    RATE_LIMIT_MAX: process.env['RATE_LIMIT_MAX'] ?? '1000000',
    ...overrides,
  };
}
