import { INTERNAL_ERROR_CODE } from './internal-error-code';
import { FIRST_SERVER_STATUS, STATUSES } from './statuses';

/** The code of a problem answered with `status` and nothing more precise: a bad request, or an internal error, when the kit does not name it. */
export function codeOfStatus(status: number): string {
  return STATUSES[status]?.code ?? (status >= FIRST_SERVER_STATUS ? INTERNAL_ERROR_CODE : 'BAD_REQUEST');
}
