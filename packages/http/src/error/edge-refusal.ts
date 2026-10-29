import { codeOfStatus } from './code-of-status';
import { statusTitle } from './status-title';

/**
 * A request refused before the pipeline runs, by an adapter or by the framework under it: a body
 * that is not JSON, a body too large. Its status, its code and, when it says nothing of the
 * request, what is wrong.
 */
export interface EdgeRefusal {
  readonly status: number;
  readonly title: string;
  readonly code: string;
  readonly detail?: string;
}

const BAD_REQUEST = 400;
const CONTENT_TOO_LARGE = 413;

export const MALFORMED_BODY: EdgeRefusal = {
  status: BAD_REQUEST,
  title: statusTitle(BAD_REQUEST),
  code: 'MALFORMED_BODY',
  detail: 'The body is not valid JSON.',
};

/** A body beyond what the server reads: the limit is said when the framework tells it. */
export function bodyTooLarge(limit: number | undefined): EdgeRefusal {
  const beyond = limit === undefined ? 'what the server reads' : `${String(limit)} bytes`;

  return {
    status: CONTENT_TOO_LARGE,
    title: statusTitle(CONTENT_TOO_LARGE),
    code: codeOfStatus(CONTENT_TOO_LARGE),
    detail: `The body is larger than ${beyond}.`,
  };
}
