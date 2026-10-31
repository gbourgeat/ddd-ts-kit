import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { eventually, until } from '../src/e2e';

describe('eventually', () => {
  it('returns what the assertion returns once it passes', async () => {
    let attempts = 0;

    const value = await eventually(
      () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error('not yet');
        }

        return 'projected';
      },
      { intervalMs: 1 },
    );

    expect(value).toBe('projected');
    expect(attempts).toBe(3);
  });

  it('fails with the last error once the time is up', async () => {
    let attempts = 0;

    const never = eventually(
      () => {
        attempts += 1;
        throw new Error(`projection is ${attempts} event(s) behind`);
      },
      { timeoutMs: 40, intervalMs: 5 },
    );

    const failure: unknown = await never.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);

    expect(failure).toMatchObject({
      message: `Still failing after 40 ms: projection is ${attempts} event(s) behind`,
      cause: { message: `projection is ${attempts} event(s) behind` },
    });

    expect(attempts).toBeGreaterThan(1);
  });

  it('quotes the message of an error from another realm, as Jest throws those of node:assert', async () => {
    const failure: unknown = await eventually(
      () => {
        throw runInNewContext("new Error('projection is behind')");
      },
      { timeoutMs: 20, intervalMs: 5 },
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({ message: 'Still failing after 20 ms: projection is behind' });
  });

  it('shows what the assertion threw when it is not an error', async () => {
    const failure: unknown = await eventually(
      () => {
        throw { behind: 2 };
      },
      { timeoutMs: 20, intervalMs: 5 },
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({ message: 'Still failing after 20 ms: { behind: 2 }', cause: { behind: 2 } });
  });
});

describe('until', () => {
  it('returns once the condition holds, a promise of a boolean included', async () => {
    let attempts = 0;

    await until(async () => (attempts += 1) >= 3, { intervalMs: 1 });

    expect(attempts).toBe(3);
  });

  it('fails when the condition never holds in time', async () => {
    const failure: unknown = await until(() => false, { timeoutMs: 20, intervalMs: 5 }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({ message: 'Still failing after 20 ms: The condition was not met' });
  });
});
