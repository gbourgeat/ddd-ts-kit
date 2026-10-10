import { act } from './act.js';
import type { AsyncOutcome } from './async-outcome.js';
import type { AsyncScenario } from './async-scenario.js';
import { DeferredOutcome } from './deferred-outcome.js';
import type { EventSource } from './event-source.js';
import { ImmediateOutcome } from './immediate-outcome.js';
import { isPromiseLike } from './is-promise-like.js';
import type { Outcome } from './outcome.js';

export interface Scenario<A> {
  /**
   * The one intention under test. Synchronous actions give assertions that throw at once;
   * an action returning a promise gives an outcome that must be awaited.
   */
  when<R>(action: (aggregate: A) => R): R extends PromiseLike<unknown> ? AsyncOutcome<A> : Outcome<A>;
}

/**
 * Same as `given`, with the arrangement written as a function: it runs when `when` is called,
 * so one scenario can be declared once and replayed from a fresh aggregate in several tests.
 */
export function scenario<A extends EventSource>(arrange: () => Promise<A>): AsyncScenario<A>;
export function scenario<A extends EventSource>(arrange: () => A): Scenario<A>;

export function scenario<A extends EventSource>(
  arrange: () => A | Promise<A>,
): Scenario<A> | AsyncScenario<A> {
  const when = (action: (aggregate: A) => unknown): Outcome<A> => {
    const arranged = arrange();

    if (isPromiseLike(arranged)) {
      return DeferredOutcome.of(Promise.resolve(arranged).then((aggregate) => act(aggregate, action)));
    }

    const recorded = act(arranged, action);

    return recorded instanceof Promise ? DeferredOutcome.of(recorded) : new ImmediateOutcome(recorded);
  };

  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the conditional return type of Scenario.when depends on the caller's action; the runtime check above follows the same rule, which the compiler cannot verify
  return { when } as Scenario<A> | AsyncScenario<A>;
}
