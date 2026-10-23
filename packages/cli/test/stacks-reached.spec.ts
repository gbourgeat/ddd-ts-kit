import { describe, expect, it } from 'vitest';
import { reachedBy, STACKS } from './e2e/stacks';
import { DEFAULT_STACK, type StackFlags } from './helpers';

const ON_KNEX_BEHIND_NATS: StackFlags = { ...DEFAULT_STACK, orm: 'knex', broker: 'nats', logger: 'pino' };
const ON_DRIZZLE: StackFlags = { ...DEFAULT_STACK, orm: 'drizzle', errors: 'glitchtip' };

describe('the stacks a change reaches', () => {
  it('are all of them when nothing is named, as on the trunk and at night', () => {
    expect(reachedBy([], ON_KNEX_BEHIND_NATS)).toBe(true);
    expect(STACKS.length).toBeGreaterThan(20);
  });

  it('are all of them when a package every project is built with changed', () => {
    for (const name of ['cli', 'kernel', 'testing', 'eslint-plugin', 'http', 'di', 'auth']) {
      expect(reachedBy([name], ON_DRIZZLE), name).toBe(true);
    }
  });

  it('are the ones whose flags name a changed package: an orm, a broker, a logger, the reporter under its other name', () => {
    expect(reachedBy(['knex'], ON_KNEX_BEHIND_NATS)).toBe(true);
    expect(reachedBy(['nats'], ON_KNEX_BEHIND_NATS)).toBe(true);
    expect(reachedBy(['pino'], ON_KNEX_BEHIND_NATS)).toBe(true);
    expect(reachedBy(['sentry'], ON_DRIZZLE)).toBe(true);
    expect(reachedBy(['drizzle', 'winston'], ON_KNEX_BEHIND_NATS)).toBe(false);
    expect(reachedBy(['redis'], ON_DRIZZLE)).toBe(false);
  });
});
