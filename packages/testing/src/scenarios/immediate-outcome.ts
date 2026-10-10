import { AssertionError } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import { describeEvent } from './describe-event.js';
import type { ErrorClass } from './error-class.js';
import type { EventMatcher } from './event-matcher.js';
import { eventMismatches } from './event-mismatches.js';
import type { Outcome } from './outcome.js';
import type { Recorded } from './recorded.js';
import { show } from './show.js';

/** The assertions about an action that already ran: each one throws at once. */
export class ImmediateOutcome<A> implements Outcome<A> {
  // An error nobody looked at must not let a state assertion pass by accident.
  private errorAsserted = false;

  constructor(private readonly recorded: Recorded<A>) {}

  thenEvents(expected: readonly EventMatcher[]): this {
    this.assertDidNotThrow('events');
    const { events } = this.recorded;

    const differences = expected.flatMap((matcher, index) => {
      const event = events[index];

      return event === undefined ? [] : eventMismatches(event, matcher, `event ${index + 1}`);
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
    this.assertDidNotThrow('events');
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
    this.assertDidNotThrow('no event');
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

    const error = this.thrownInsteadOf(expected);
    const wrongType = type !== undefined && !(error instanceof type);
    const wrongCode = expectedCode !== undefined && codeOf(error) !== expectedCode;

    if (wrongType || wrongCode) {
      throw new AssertionError({
        message: `Expected the action to fail with ${expected}, but it failed with ${describeError(error)}.`,
        actual: describeError(error),
        expected,
        operator: 'thenError',
      });
    }

    this.errorAsserted = true;

    return this;
  }

  thenState(inspectState: (aggregate: A) => void): this {
    if (!this.errorAsserted) {
      this.assertDidNotThrow('a state');
    }

    inspectState(this.recorded.aggregate);

    return this;
  }

  private thrownInsteadOf(expected: string): unknown {
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

    return thrown.error;
  }

  private assertDidNotThrow(expectation: string): void {
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

function count(n: number): string {
  return `${n} event${n === 1 ? '' : 's'}`;
}

function section(title: string, lines: readonly string[]): string[] {
  return [`${title}:`, ...(lines.length === 0 ? ['  (none)'] : lines.map((line, index) => `  ${index + 1}. ${line}`))];
}

function describeMatcher(matcher: EventMatcher): string {
  if (typeof matcher === 'string') {
    return matcher;
  }

  return typeof matcher === 'function' ? `instance of ${matcher.name}` : show(matcher);
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return show(error);
  }

  const code = codeOf(error);

  return `${error.constructor.name}${code === undefined ? '' : ` (code ${code})`}: ${error.message}`;
}
