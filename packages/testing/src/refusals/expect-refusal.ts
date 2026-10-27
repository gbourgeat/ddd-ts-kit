import { AssertionError } from 'node:assert';
import { errorClassOf } from '../scenarios/error-class-of';
import { isErrorLike } from '../scenarios/is-error-like';
import { isPromiseLike } from '../scenarios/is-promise-like';
import { show } from '../scenarios/show';
import type { ExpectedFacts } from './expected-facts';
import { factMismatches } from './fact-mismatches';

interface Attempt {
  readonly refused: boolean;
  readonly error?: unknown;
}

/**
 * Asserts a business refusal by its code, and by its facts when given: on an error that was
 * caught, on a `Result`, or on an action, which is run. The class of the error is not looked
 * at. Returns the error; an action that returns a promise gives a promise to await.
 *
 *     expectRefusal(() => appointment.cancel(at), 'APPOINTMENT_ENDED', { status: 'cancelled' });
 *     expectRefusal(() => Email.create('nope'), 'INVALID_EMAIL');
 *     expectRefusal(Email.create('nope'), 'INVALID_EMAIL'); // a factory that returns a Result
 *     await expectRefusal(() => bus.execute(command), 'SLOT_TAKEN');
 */
export function expectRefusal(
  subject: () => PromiseLike<unknown>,
  code: string,
  facts?: ExpectedFacts,
): Promise<unknown>;
export function expectRefusal(subject: unknown, code: string, facts?: ExpectedFacts): unknown;

export function expectRefusal(subject: unknown, code: string, facts: ExpectedFacts = {}): unknown {
  const attempt = attempted(subject);

  if (isPromiseLike(attempt)) {
    return Promise.resolve(attempt).then(
      () => refusalOf({ refused: false }, code, facts),
      (error: unknown) => refusalOf({ refused: true, error }, code, facts),
    );
  }

  return refusalOf(attempt, code, facts);
}

function attempted(subject: unknown): Attempt | PromiseLike<unknown> {
  if (!isAction(subject)) {
    return outcomeOf(subject);
  }

  try {
    const answer: unknown = subject();

    return isPromiseLike(answer) ? answer : outcomeOf(answer, { ran: true });
  } catch (error) {
    return { refused: true, error };
  }
}

function isAction(subject: unknown): subject is () => unknown {
  return typeof subject === 'function';
}

/** A `Result` says by itself whether it refuses; anything else an action returned is a success. */
function outcomeOf(value: unknown, { ran = false } = {}): Attempt {
  if (typeof value === 'object' && value !== null && 'ok' in value && typeof value.ok === 'boolean') {
    return value.ok || !('error' in value) ? { refused: false } : { refused: true, error: value.error };
  }

  return ran ? { refused: false } : { refused: true, error: value };
}

function refusalOf(attempt: Attempt, code: string, facts: ExpectedFacts): unknown {
  if (!attempt.refused) {
    throw failure(`Expected a refusal with code ${code}, but nothing was refused.`, undefined, code);
  }

  const { error } = attempt;
  const actual = codeOf(error);

  if (actual !== code) {
    throw failure(`Expected a refusal with code ${code}, but got ${described(error)}.`, actual, code);
  }

  const mismatches = factMismatches(error, facts);

  if (mismatches.length > 0) {
    throw failure([`The refusal ${code} does not carry the expected facts.`, ...mismatches].join('\n  '), error, facts);
  }

  return error;
}

function failure(message: string, actual: unknown, expected: unknown): AssertionError {
  return new AssertionError({ message, actual, expected, operator: 'expectRefusal' });
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function described(error: unknown): string {
  if (!isErrorLike(error)) {
    return show(error);
  }

  const code = codeOf(error);

  return `${errorClassOf(error)}${code === undefined ? '' : ` (code ${code})`}: ${error.message}`;
}
