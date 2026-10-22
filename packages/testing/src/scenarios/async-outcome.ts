import type { Outcome } from './outcome';

/** The outcome of an asynchronous `when` or arrangement: same assertions, to be awaited. */
export interface AsyncOutcome<A> extends Outcome<A>, PromiseLike<void> {}
