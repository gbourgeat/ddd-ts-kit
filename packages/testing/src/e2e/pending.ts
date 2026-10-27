import { inspect } from 'node:util';
import { isErrorLike } from '../scenarios/is-error-like';

/** The body of an acceptance scenario: requests to the application and assertions on what it answers. */
export type ScenarioBody = () => Promise<void>;

/**
 * Holds an acceptance scenario written before the code that satisfies it. The scenario runs, and
 * the test passes while one of its assertions fails, which is what a scenario of a story not built
 * yet does. It fails in the two other cases: when the scenario passes, the row it waits for is
 * built and `pending(...)` is to be removed; when it stops on anything but an assertion (a
 * `TypeError`, a request the client cannot send), the scenario itself is broken, and a broken
 * scenario would otherwise read as one waiting for its code.
 *
 * ```ts
 * it('#US5.02 a customer places an order and reads its number', pending(async () => { ... }));
 * ```
 */
export function pending(body: ScenarioBody): ScenarioBody {
  return async () => {
    const failure = await failureOf(body);

    if (failure === undefined) {
      throw new Error(
        'The scenario passes: the code it waited for is built. Remove `pending(...)` around it, in the commit of the row that satisfies it.',
      );
    }

    if (!isAssertion(failure)) {
      throw new Error(
        `The scenario stops on ${shown(failure)}, not on an assertion: fix the scenario, which an absent route answers with a status, never with an error of the test.`,
        { cause: failure },
      );
    }
  };
}

async function failureOf(body: ScenarioBody): Promise<unknown> {
  try {
    await body();

    return undefined;
  } catch (error) {
    return error ?? new Error('A scenario threw nothing.');
  }
}

/**
 * An assertion failure, through the causes a helper wraps it in (`eventually`): `node:assert` and
 * the `expect` of Vitest name it `AssertionError`, the `expect` of Jest carries its `matcherResult`.
 * Each failure is read by its shape: under Jest, an `AssertionError` of `node:assert` comes from
 * another realm and is not an instance of the `Error` this module sees.
 */
function isAssertion(failure: unknown): boolean {
  const seen = new Set<unknown>();

  for (let current = failure; isErrorLike(current) && !seen.has(current); current = current.cause) {
    if (current.name === 'AssertionError' || 'matcherResult' in current) {
      return true;
    }

    seen.add(current);
  }

  return false;
}

function shown(failure: unknown): string {
  return isErrorLike(failure) ? `${failure.name}: ${failure.message}` : inspect(failure);
}
