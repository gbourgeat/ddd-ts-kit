import type { ExpectedFacts } from '../refusals/expected-facts';
import type { ErrorClass } from './error-class';
import type { EventMatcher } from './event-matcher';

/** The assertions available once `when` ran. Each returns the outcome, so they chain. */
export interface Outcome<A> {
  /** Exactly these events, in this order. */
  thenEvents(expected: readonly EventMatcher[]): this;
  /** Exactly these event names, in this order. */
  thenEventNames(expected: readonly string[]): this;
  thenNoEvent(): this;
  /** The action threw an instance of `type` (and, when given, with this `code`). */
  thenError(type: ErrorClass, code?: string): this;
  /** The action threw an error carrying this `code`, whatever its class, and these facts when given. */
  thenError(code: string, facts?: ExpectedFacts): this;
  /** Inspects the aggregate after the action; `inspect` asserts with the runner's own tools. */
  thenState(inspect: (aggregate: A) => void): this;
}
