import type { Problem } from '../error/problem.js';
import type { HttpMethod } from '../route/http-method.js';

export interface ErrorContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** The response the client receives for this error. */
  readonly problem: Problem;
}
