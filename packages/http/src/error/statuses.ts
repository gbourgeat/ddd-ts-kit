import { INTERNAL_ERROR_CODE } from './internal-error-code';

/** What the kit names a status: its title, and the code of a problem answered with it and nothing more precise. */
export interface StatusNames {
  readonly title: string;
  readonly code: string;
}

/**
 * The statuses the kit names, the one table the titles of its problems and the codes of its
 * refusals at the edge are read from. A code is the one the pipeline answers for that status
 * (`VALIDATION_FAILED` for 422, `RATE_LIMITED` for 429 as the limit of the callers), so that a
 * client tells a refusal by its code wherever it was refused.
 */
export const STATUSES: Readonly<Record<number, StatusNames>> = {
  400: { title: 'Bad Request', code: 'BAD_REQUEST' },
  401: { title: 'Unauthorized', code: 'UNAUTHORIZED' },
  402: { title: 'Payment Required', code: 'PAYMENT_REQUIRED' },
  403: { title: 'Forbidden', code: 'FORBIDDEN' },
  404: { title: 'Not Found', code: 'NOT_FOUND' },
  405: { title: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' },
  406: { title: 'Not Acceptable', code: 'NOT_ACCEPTABLE' },
  408: { title: 'Request Timeout', code: 'REQUEST_TIMEOUT' },
  409: { title: 'Conflict', code: 'CONFLICT' },
  410: { title: 'Gone', code: 'GONE' },
  412: { title: 'Precondition Failed', code: 'PRECONDITION_FAILED' },
  413: { title: 'Content Too Large', code: 'BODY_TOO_LARGE' },
  415: { title: 'Unsupported Media Type', code: 'UNSUPPORTED_MEDIA_TYPE' },
  422: { title: 'Unprocessable Content', code: 'VALIDATION_FAILED' },
  423: { title: 'Locked', code: 'LOCKED' },
  428: { title: 'Precondition Required', code: 'PRECONDITION_REQUIRED' },
  429: { title: 'Too Many Requests', code: 'RATE_LIMITED' },
  500: { title: 'Internal Server Error', code: INTERNAL_ERROR_CODE },
  501: { title: 'Not Implemented', code: 'NOT_IMPLEMENTED' },
  502: { title: 'Bad Gateway', code: 'BAD_GATEWAY' },
  503: { title: 'Service Unavailable', code: 'SERVICE_UNAVAILABLE' },
  504: { title: 'Gateway Timeout', code: 'GATEWAY_TIMEOUT' },
};

export const FIRST_SERVER_STATUS = 500;
