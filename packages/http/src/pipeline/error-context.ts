import type { ExecutionContext } from '@ddd-ts-kit/kernel';
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
  /** The execution context of the request, when the failure happened after it was built: not for a refused credential or an invalid request. */
  readonly execution?: ExecutionContext;
}
