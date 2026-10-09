import { AssertionError } from 'node:assert';
import { inspect, isDeepStrictEqual } from 'node:util';
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { resolve, type Resolvable } from './builder.js';

/** What a scenario needs from an aggregate: the events it recorded. */
export interface EventSource {
  pullEvents(): DomainEvent[];
}

type ErrorClass = abstract new (...args: never[]) => Error;
type EventClass = abstract new (...args: never[]) => DomainEvent;

/**
 * How an expected event is described: its name, its class, or the properties that matter
 * (a subset: properties left out are not compared).
 */
export type EventMatcher = string | EventClass | { readonly [property: string]: unknown };

interface Recorded<A> {
  readonly aggregate: A;
  readonly events: readonly DomainEvent[];
  readonly thrown: { readonly error: unknown } | undefined;
}

/** The assertions available once `when` ran. Each returns the outcome, so they chain. */
export interface Outcome<A> {
  /** Exactly these events, in this order. */
  thenEvents(expected: readonly EventMatcher[]): this;
  /** Exactly these event names, in this order. */
  thenEventNames(expected: readonly string[]): this;
  thenNoEvent(): this;
  /** The action threw an instance of `type` (and, when given, with this `code`). */
  thenError(type: ErrorClass, code?: string): this;
  /** The action threw an error carrying this `code`, whatever its class. */
  thenError(code: string): this;
  /** Inspects the aggregate after the action; `inspect` asserts with the runner's own tools. */
  thenState(inspect: (aggregate: A) => void): this;
}

/** The outcome of an asynchronous `when` or arrangement: same assertions, to be awaited. */
export interface AsyncOutcome<A> extends Outcome<A>, PromiseLike<void> {}

export interface Scenario<A> {
  /**
   * The one intention under test. Synchronous actions give assertions that throw at once;
   * an action returning a promise gives an outcome that must be awaited.
   */
  when<R>(action: (aggregate: A) => R): R extends PromiseLike<unknown> ? AsyncOutcome<A> : Outcome<A>;
}

export interface AsyncScenario<A> {
  when(action: (aggregate: A) => unknown): AsyncOutcome<A>;
}

/**
 * Starts a scenario from an aggregate (or its builder) in its "given" state. The events
 * recorded while arranging are discarded, so only the events of `when` are asserted.
 */
export function given<A extends EventSource>(aggregate: A | Resolvable<A>): Scenario<A> {
  return scenario(() => resolve(aggregate));
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
      return deferred(Promise.resolve(arranged).then((aggregate) => act(aggregate, action)));
    }
    const recorded = act(arranged, action);
    return recorded instanceof Promise ? deferred(recorded) : new ImmediateOutcome(recorded);
  };
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the conditional return type of Scenario.when depends on the caller's action; the runtime check above follows the same rule, which the compiler cannot verify
  return { when } as Scenario<A> | AsyncScenario<A>;
}

function act<A extends EventSource>(
  aggregate: A,
  action: (aggregate: A) => unknown,
): Recorded<A> | Promise<Recorded<A>> {
  aggregate.pullEvents();
  const record = (thrown: Recorded<A>['thrown']): Recorded<A> => ({
    aggregate,
    events: aggregate.pullEvents(),
    thrown,
  });
  try {
    const result = action(aggregate);
    if (isPromiseLike(result)) {
      return Promise.resolve(result).then(
        () => record(undefined),
        (error: unknown) => record({ error }),
      );
    }
    return record(undefined);
  } catch (error) {
    return record({ error });
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function'
  );
}

class ImmediateOutcome<A> implements Outcome<A> {
  // An error nobody looked at must not let a state assertion pass by accident.
  #errorAsserted = false;

  constructor(private readonly recorded: Recorded<A>) {}

  thenEvents(expected: readonly EventMatcher[]): this {
    this.#assertDidNotThrow('events');
    const { events } = this.recorded;
    const differences = expected.flatMap((matcher, index) => {
      const event = events[index];
      return event === undefined ? [] : mismatches(event, matcher, `event ${index + 1}`);
    });
    if (events.length !== expected.length) {
      differences.unshift(`expected ${count(expected.length)}, recorded ${count(events.length)}`);
    }
    if (differences.length > 0) {
      throw new AssertionError({
        message: [
          'The recorded events are not the expected ones.',
          ...section('Expected', expected.map(describeMatcher)),
          ...section('Recorded', events.map(describeEvent)),
          ...section('Difference', differences),
        ].join('\n'),
        actual: events.map(describeEvent),
        expected: expected.map(describeMatcher),
        operator: 'thenEvents',
      });
    }
    return this;
  }

  thenEventNames(expected: readonly string[]): this {
    this.#assertDidNotThrow('events');
    const actual = this.recorded.events.map((event) => event.name);
    if (!isDeepStrictEqual(actual, [...expected])) {
      throw new AssertionError({
        message: [
          'The recorded event names are not the expected ones.',
          ...section('Expected', [...expected]),
          ...section('Recorded', actual),
        ].join('\n'),
        actual,
        expected,
        operator: 'thenEventNames',
      });
    }
    return this;
  }

  thenNoEvent(): this {
    this.#assertDidNotThrow('no event');
    const { events } = this.recorded;
    if (events.length > 0) {
      throw new AssertionError({
        message: ['Expected no event.', ...section('Recorded', events.map(describeEvent))].join('\n'),
        actual: events.map(describeEvent),
        expected: [],
        operator: 'thenNoEvent',
      });
    }
    return this;
  }

  thenError(typeOrCode: ErrorClass | string, code?: string): this {
    const type = typeof typeOrCode === 'string' ? undefined : typeOrCode;
    const expectedCode = typeof typeOrCode === 'string' ? typeOrCode : code;
    const expected = [type?.name, expectedCode === undefined ? undefined : `code ${expectedCode}`]
      .filter((part) => part !== undefined)
      .join(' with ');
    const { thrown, events } = this.recorded;
    if (thrown === undefined) {
      throw new AssertionError({
        message: [
          `Expected the action to fail with ${expected}, but it succeeded.`,
          ...section('Recorded', events.map(describeEvent)),
        ].join('\n'),
        actual: undefined,
        expected,
        operator: 'thenError',
      });
    }
    const wrongType = type !== undefined && !(thrown.error instanceof type);
    const wrongCode = expectedCode !== undefined && codeOf(thrown.error) !== expectedCode;
    if (wrongType || wrongCode) {
      throw new AssertionError({
        message: `Expected the action to fail with ${expected}, but it failed with ${describeError(thrown.error)}.`,
        actual: describeError(thrown.error),
        expected,
        operator: 'thenError',
      });
    }
    this.#errorAsserted = true;
    return this;
  }

  thenState(inspectState: (aggregate: A) => void): this {
    if (!this.#errorAsserted) {
      this.#assertDidNotThrow('a state');
    }
    inspectState(this.recorded.aggregate);
    return this;
  }

  #assertDidNotThrow(expectation: string): void {
    const { thrown } = this.recorded;
    if (thrown !== undefined) {
      throw new AssertionError({
        message: `Expected ${expectation}, but the action failed with ${describeError(thrown.error)}.`,
        actual: thrown.error,
        expected: undefined,
        operator: 'when',
      });
    }
  }
}

class DeferredOutcome<A> implements AsyncOutcome<A> {
  constructor(private readonly pending: Promise<ImmediateOutcome<A>>) {}

  thenEvents(expected: readonly EventMatcher[]): this {
    return this.#after((outcome) => outcome.thenEvents(expected));
  }

  thenEventNames(expected: readonly string[]): this {
    return this.#after((outcome) => outcome.thenEventNames(expected));
  }

  thenNoEvent(): this {
    return this.#after((outcome) => outcome.thenNoEvent());
  }

  thenError(typeOrCode: ErrorClass | string, code?: string): this {
    return this.#after((outcome) =>
      typeof typeOrCode === 'string' ? outcome.thenError(typeOrCode) : outcome.thenError(typeOrCode, code),
    );
  }

  thenState(inspectState: (aggregate: A) => void): this {
    return this.#after((outcome) => outcome.thenState(inspectState));
  }

  then<Fulfilled = void, Rejected = never>(
    onFulfilled?: ((value: undefined) => Fulfilled | PromiseLike<Fulfilled>) | null,
    onRejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
  ): PromiseLike<Fulfilled | Rejected> {
    return this.pending.then(() => undefined).then(onFulfilled, onRejected);
  }

  #after(assert: (outcome: ImmediateOutcome<A>) => ImmediateOutcome<A>): this {
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- Outcome methods answer `this`; the chain stays immutable, so the answer is a new object of the same class
    return new DeferredOutcome(this.pending.then(assert)) as this;
  }
}

function deferred<A>(recorded: Promise<Recorded<A>>): DeferredOutcome<A> {
  return new DeferredOutcome(recorded.then((result) => new ImmediateOutcome(result)));
}

function mismatches(event: DomainEvent, matcher: EventMatcher, where: string): string[] {
  if (typeof matcher === 'string') {
    return matcher === event.name
      ? []
      : [`${where}: expected name ${show(matcher)}, recorded ${show(event.name)}`];
  }
  if (typeof matcher === 'function') {
    return event instanceof matcher
      ? []
      : [`${where}: expected an instance of ${matcher.name}, recorded ${describeEvent(event)}`];
  }
  return subsetDifferences(event, matcher, where);
}

function subsetDifferences(actual: unknown, expected: unknown, path: string): string[] {
  if (isPlainObject(expected) && typeof actual === 'object' && actual !== null) {
    return Object.entries(expected).flatMap(([key, value]) => {
      // Reflect.get rather than a spread: an event class may expose a property through a getter.
      const recorded: unknown = Reflect.get(actual, key);
      return subsetDifferences(recorded, value, `${path}.${key}`);
    });
  }
  return isDeepStrictEqual(actual, expected)
    ? []
    : [`${path}: expected ${show(expected)}, recorded ${show(actual)}`];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function describeMatcher(matcher: EventMatcher): string {
  if (typeof matcher === 'string') {
    return matcher;
  }
  return typeof matcher === 'function' ? `instance of ${matcher.name}` : show(matcher);
}

function describeEvent(event: DomainEvent): string {
  const { name, ...rest } = event;
  return `${name} ${show(rest)}`;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return show(error);
  }
  const code = codeOf(error);
  return `${error.constructor.name}${code === undefined ? '' : ` (code ${code})`}: ${error.message}`;
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function section(title: string, lines: readonly string[]): string[] {
  return [
    `${title}:`,
    ...(lines.length === 0 ? ['  (none)'] : lines.map((line, index) => `  ${index + 1}. ${line}`)),
  ];
}

function count(n: number): string {
  return `${n} event${n === 1 ? '' : 's'}`;
}

function show(value: unknown): string {
  return inspect(value, { depth: 4, breakLength: Infinity, sorted: true });
}
