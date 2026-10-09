import { DomainError } from '@ddd-ts-kit/kernel';

export const TIMEOUT = 'TIMEOUT';

/** The call did not answer in time. An infrastructure fault: retried by default. */
export class TimeoutError extends Error {
  readonly code = TIMEOUT;

  constructor(
    operation: string,
    readonly timeoutMs: number,
  ) {
    super(`${operation} did not answer within ${String(timeoutMs)} ms`);
    this.name = 'TimeoutError';
  }
}

export const CIRCUIT_OPEN = 'CIRCUIT_OPEN';

/** The call was not made: the dependency failed too often and is given time to recover. */
export class CircuitOpenError extends Error {
  readonly code = CIRCUIT_OPEN;

  constructor(
    operation: string,
    /** The instant from which a trial call is let through. */
    readonly retryAt: Date,
  ) {
    super(`${operation} is not called: its circuit is open until ${retryAt.toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

export const BULKHEAD_FULL = 'BULKHEAD_FULL';

/** The call was not made: too many are running and waiting already. */
export class BulkheadFullError extends Error {
  readonly code = BULKHEAD_FULL;

  constructor(operation: string) {
    super(`${operation} is not called: its bulkhead is full`);
    this.name = 'BulkheadFullError';
  }
}

/** An aspect was put where it must not go: a wiring mistake, raised when the instance is wrapped. */
export class AspectNotAllowedError extends Error {
  readonly code = 'ASPECT_NOT_ALLOWED';

  constructor(message: string) {
    super(message);
    this.name = 'AspectNotAllowedError';
  }
}

export interface ErrorDescription {
  /** The class name of the error. */
  readonly errorType: string;
  /** The `code` of a `DomainError`, or of a fault that carries a short one (`TIMEOUT`, `ECONNRESET`). */
  readonly errorCode?: string;
}

const SHORT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** What may be recorded about a caught error. Never its message: it quotes data. */
export function describeError(error: unknown): ErrorDescription {
  const errorCode = codeOf(error);
  return {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

/** A business refusal: the dependency answered, and asking again would get the same answer. */
export function isBusinessRefusal(error: unknown): boolean {
  return error instanceof DomainError;
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error;
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined;
}
