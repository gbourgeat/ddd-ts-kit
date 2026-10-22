import { AssertionError, strictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { eventually, pending } from '../src/e2e';

describe('pending', () => {
  it('passes while an assertion of the scenario fails: the code it waits for is not built', async () => {
    await expect(pending(async () => strictEqual(404, 201))()).resolves.toBeUndefined();
  });

  it('passes on the expect of the test runner', async () => {
    await expect(pending(async () => expect(404).toBe(201))()).resolves.toBeUndefined();
  });

  it('passes on an assertion that eventually wraps', async () => {
    const scenario = pending(async () => {
      await eventually(() => strictEqual('placed', 'paid'), { timeoutMs: 30, intervalMs: 10 });
    });

    await expect(scenario()).resolves.toBeUndefined();
  });

  it('passes on the failure of a Jest matcher, which carries its result', async () => {
    const jestFailure = Object.assign(new Error('expect(received).toBe(expected)'), { matcherResult: { pass: false } });

    await expect(
      pending(async () => {
        throw jestFailure;
      })(),
    ).resolves.toBeUndefined();
  });

  it('fails once the scenario passes, asking to remove pending', async () => {
    await expect(pending(async () => strictEqual(201, 201))()).rejects.toThrow(/Remove `pending\(\.\.\.\)`/);
  });

  it('fails when the scenario stops on an error that is not an assertion, with that error as its cause', async () => {
    const broken = new TypeError('Cannot read properties of undefined');

    const scenario = pending(async () => {
      throw broken;
    });

    await expect(scenario()).rejects.toThrow(/stops on TypeError: Cannot read properties of undefined/);
    await expect(scenario()).rejects.toMatchObject({ cause: broken });
  });

  it('fails when the scenario throws what is not an error', async () => {
    await expect(
      pending(async () => {
        throw 'refused';
      })(),
    ).rejects.toThrow(/stops on 'refused'/);
  });

  it('fails when the scenario throws nothing at all, saying so', async () => {
    await expect(
      pending(async () => {
        throw undefined;
      })(),
    ).rejects.toThrow(/stops on Error: A scenario threw nothing\./);
  });

  it('treats an AssertionError of node:assert built by hand as an assertion', async () => {
    const failure = new AssertionError({ message: 'Expected status 201, received 404', actual: 404, expected: 201 });

    await expect(
      pending(async () => {
        throw failure;
      })(),
    ).resolves.toBeUndefined();
  });
});
