import type { RawHeaders } from '../route/raw-headers';
import type { EdgeErrorOptions } from './answered-edge-error';
import { codeOfStatus } from './code-of-status';
import { type EdgeAnswer, edgeAnswer } from './edge-answer';
import type { EdgeRefusal } from './edge-refusal';
import { statusTitle } from './status-title';

const NOT_FOUND_STATUS = 404;

const NOT_FOUND: EdgeRefusal = {
  status: NOT_FOUND_STATUS,
  title: statusTitle(NOT_FOUND_STATUS),
  code: codeOfStatus(NOT_FOUND_STATUS),
};

/**
 * The answer to a path no route serves: 404 `NOT_FOUND`, a problem as every other refusal, as
 * the filter of Nest answers it, logged by its status and the request id at `info`: a scanner
 * probes paths by the thousand, and a warning per probe would drown the ones that matter.
 */
export function answeredNotFound(headers: Readonly<RawHeaders>, options: EdgeErrorOptions): EdgeAnswer {
  const answer = edgeAnswer(headers, NOT_FOUND);

  options.logger?.info('request refused before its route', {
    errorType: NOT_FOUND.code,
    status: answer.status,
    requestId: answer.problem.requestId,
  });

  return answer;
}
