import type { AsyncOutcome } from './async-outcome.js';
import type { ErrorClass } from './error-class.js';
import type { EventMatcher } from './event-matcher.js';
import { ImmediateOutcome } from './immediate-outcome.js';
import type { Recorded } from './recorded.js';

/** The assertions of an outcome that is not known yet: each one waits for it, the chain is awaited. */
export class DeferredOutcome<A> implements AsyncOutcome<A> {
  static of<A>(recorded: Promise<Recorded<A>>): DeferredOutcome<A> {
    return new DeferredOutcome(recorded.then((result) => new ImmediateOutcome(result)));
  }

  private constructor(private readonly pending: Promise<ImmediateOutcome<A>>) {}

  thenEvents(expected: readonly EventMatcher[]): this {
    return this.after((outcome) => outcome.thenEvents(expected));
  }

  thenEventNames(expected: readonly string[]): this {
    return this.after((outcome) => outcome.thenEventNames(expected));
  }

  thenNoEvent(): this {
    return this.after((outcome) => outcome.thenNoEvent());
  }

  thenError(typeOrCode: ErrorClass | string, code?: string): this {
    return this.after((outcome) =>
      typeof typeOrCode === 'string' ? outcome.thenError(typeOrCode) : outcome.thenError(typeOrCode, code),
    );
  }

  thenState(inspectState: (aggregate: A) => void): this {
    return this.after((outcome) => outcome.thenState(inspectState));
  }

  then<Fulfilled = void, Rejected = never>(
    onFulfilled?: ((value: undefined) => Fulfilled | PromiseLike<Fulfilled>) | null,
    onRejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
  ): PromiseLike<Fulfilled | Rejected> {
    return this.pending.then(() => undefined).then(onFulfilled, onRejected);
  }

  private after(assert: (outcome: ImmediateOutcome<A>) => ImmediateOutcome<A>): this {
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- Outcome methods answer `this`; the chain stays immutable, so the answer is a new object of the same class
    return new DeferredOutcome(this.pending.then(assert)) as this;
  }
}
