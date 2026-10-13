{{header}}
import { type Failure, ProblemError } from './runtime.js';
import type * as Schemas from './schemas.js';

/** Every error code an operation of the API declares: branch on these, never on a title or a message. */
export const ERROR_CODES = {{codes}} as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** A problem document of the API with one of its codes. */
export type ProblemOf<Code extends ErrorCode = ErrorCode> = Failure<number, Code, {{problem}}>['problem'];

export function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value);
}

/**
 * True when `unwrap` threw a refusal of the API with one of the codes, any of its codes when none
 * is given: `if (isProblem(error, 'SOME_CODE')) { ... }`.
 */
export function isProblem<Code extends ErrorCode>(
  error: unknown,
  ...codes: readonly Code[]
): error is ProblemError<Failure<number, Code, {{problem}}>> & { readonly code: Code } {
  if (!(error instanceof ProblemError)) {
    return false;
  }

  return codes.length === 0 ? isErrorCode(error.code) : codes.some((code) => code === error.code);
}
