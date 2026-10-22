import { ResponseContractError } from '../error/response-contract-error';
import { valuesAt } from '../support/values-at';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** The `Last-Modified` of an answer, from the instant its body carries under `field`: a `Date` or ISO 8601 text. */
export function lastModifiedOf(field: string, body: unknown): string {
  const [written] = valuesAt(body, field);

  const instant =
    written instanceof Date || (typeof written === 'string' && ISO_INSTANT.test(written))
      ? new Date(written)
      : undefined;

  if (instant === undefined || Number.isNaN(instant.getTime())) {
    throw new ResponseContractError(`The answer carries no instant under "${field}" for its Last-Modified.`);
  }

  return instant.toUTCString();
}
