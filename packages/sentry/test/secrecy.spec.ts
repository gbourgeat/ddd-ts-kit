import { inspect } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { SentryErrorReporter } from '../src/index.js';
import { aTracker, type Tracker } from './support/a-tracker.js';
import { expectNoSecret } from './support/expect-no-secret.js';

let tracker: Tracker | undefined;

afterEach(async () => {
  await tracker?.stop();
});

it('shows nothing of the DSN when the reporter is serialised, spread, listed or inspected', async () => {
  tracker = await aTracker();

  const { dsn } = tracker.server;
  const publicKey = new URL(dsn).username;

  expect(tracker.errors).toBeInstanceOf(SentryErrorReporter);
  expectNoSecret(tracker.errors, [dsn, publicKey]);
  expect(Object.keys(tracker.errors)).toEqual([]);
  expect(JSON.stringify({ errors: tracker.errors })).toBe('{"errors":"SentryErrorReporter [client concealed]"}');
  expect(inspect(tracker.errors)).toBe('SentryErrorReporter [client concealed]');
});
