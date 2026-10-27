import { AssertionError, strictEqual } from 'node:assert';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { eventually, pending } from '../src/e2e';

/**
 * An error built in another realm, as Jest shows an `AssertionError` of `node:assert` to a spec
 * that runs in its vm context: an error by its shape, not an instance of the `Error` seen here.
 */
const fromAnotherRealm = (source: string): unknown => runInNewContext(source);

const foreignAssertion = (): unknown =>
  fromAnotherRealm("Object.assign(new Error('Expected status 200, received 404'), { name: 'AssertionError' })");

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

  it('treats an assertion error from another realm as an assertion, as Jest throws those of node:assert', async () => {
    const failure = foreignAssertion();

    expect(failure instanceof Error).toBe(false);

    await expect(
      pending(async () => {
        throw failure;
      })(),
    ).resolves.toBeUndefined();
  });

  it('treats an assertion error from another realm that eventually wraps as an assertion', async () => {
    const scenario = pending(async () => {
      await eventually(
        () => {
          throw foreignAssertion();
        },
        { timeoutMs: 30, intervalMs: 10 },
      );
    });

    await expect(scenario()).resolves.toBeUndefined();
  });

  it('treats a thrown object shaped like an assertion error as an assertion', async () => {
    await expect(
      pending(async () => {
        throw { name: 'AssertionError', message: 'Expected status 200, received 404' };
      })(),
    ).resolves.toBeUndefined();
  });

  it('fails on an error from another realm that is not an assertion, naming it', async () => {
    const broken = fromAnotherRealm("new TypeError('Cannot read properties of undefined')");

    const scenario = pending(async () => {
      throw broken;
    });

    await expect(scenario()).rejects.toThrow(/stops on TypeError: Cannot read properties of undefined/);
    await expect(scenario()).rejects.toMatchObject({ cause: broken });
  });

  it('fails on errors whose causes loop without an assertion, instead of walking them forever', async () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });

    first.cause = second;

    await expect(
      pending(async () => {
        throw first;
      })(),
    ).rejects.toThrow(/stops on Error: first/);
  });
});
