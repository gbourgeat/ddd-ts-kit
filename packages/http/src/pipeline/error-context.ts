import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import type { Problem } from '../error/problem.js';
import type { HttpMethod } from '../route/http-method.js';

export interface ErrorContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** The response the client receives for this error; for an interrupted stream, what it would have received. */
  readonly problem: Problem;
  /**
   * The failure came while a streamed list was written, after the status: the client received a
   * response cut short, not the problem. Count it as a server fault whatever the problem says.
   */
  readonly interrupted?: boolean;
  /** The execution context of the request, when the failure happened after it was built: not for a refused credential or an invalid request. */
  readonly execution?: ExecutionContext;
}
