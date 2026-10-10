import { DomainError } from '../../domain/errors/domain-error.js';
import { isUnexpectedError } from '../error-reporting/is-unexpected-error.js';
import type { ErrorDescription } from './error-description.js';
import { SCRUBBED_MESSAGE } from './scrubbed-message.js';

export interface DescribeErrorOptions {
  /**
   * Replaces the message of every unexpected error, anything but a `DomainError`, by
   * `SCRUBBED_MESSAGE`. Default `false`. The option every logger of the kit takes under this name.
   */
  readonly scrubMessages?: boolean;
}

const DEEPEST_CAUSE = 8;
const FIRST_FRAME = /^\s+at /m;

/**
 * An error as every logger of the port writes it: its class, its code when it is a
 * `DomainError`, its message and its own stack, then its cause the same way, eight errors deep
 * at most. Each error of the chain is written once: the stack of an error never quotes its
 * cause, and the message of the cause stays out of the message.
 */
export function describeError(error: Error, options: DescribeErrorOptions = {}): ErrorDescription {
  return described(error, options.scrubMessages === true, DEEPEST_CAUSE);
}

function described(error: Error, scrubbing: boolean, depth: number): ErrorDescription {
  const scrubbed = scrubbing && isUnexpectedError(error);
  const stack = stackOf(error, scrubbed);

  return {
    type: error.constructor.name,
    ...(error instanceof DomainError ? { code: error.code } : {}),
    message: scrubbed ? SCRUBBED_MESSAGE : error.message,
    ...(stack === undefined ? {} : { stack }),
    ...(error.cause instanceof Error && depth > 1 ? { cause: described(error.cause, scrubbing, depth - 1) } : {}),
  };
}

/** The first line of a stack repeats the message: a scrubbed error keeps its frames only. */
function stackOf(error: Error, scrubbed: boolean): string | undefined {
  if (error.stack === undefined || !scrubbed) return error.stack;

  const firstFrame = error.stack.search(FIRST_FRAME);

  return firstFrame === -1 ? undefined : error.stack.slice(firstFrame);
}
