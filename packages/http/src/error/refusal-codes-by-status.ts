import { IfMatch } from '../cache/if-match';
import { NOT_ACCEPTABLE } from '../representation/not-acceptable-error';
import type { Representations } from '../representation/representations';
import { UNSUPPORTED_MEDIA_TYPE } from '../representation/unsupported-media-type-error';
import { answersWithSchema } from '../route/answers-with-schema';
import type { Route } from '../route/route';
import type { ErrorMapper } from './error-mapper';

const VALIDATION_FAILED = 'VALIDATION_FAILED';
const PRECONDITION_FAILED = 'PRECONDITION_FAILED';
const PRECONDITION_REQUIRED = 'PRECONDITION_REQUIRED';
/** What a route that declares an upload may answer besides its own codes: a file too large, of another type, or missing. */
const UPLOAD_REFUSALS = ['FILE_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', VALIDATION_FAILED];

/**
 * The error codes a route may answer, by the status the mapper gives each: those it declares,
 * plus those the pipeline answers for it (a refused input, an upload, a precondition, a media
 * type under negotiation). What the contract documents in `x-error-codes`, and what an oRPC
 * procedure declares.
 */
export function refusalCodesByStatus(
  route: Route,
  mapper: ErrorMapper,
  representations: Representations | undefined,
): Map<number, string[]> {
  const validatesInput = Object.values(route.request ?? {}).some((schema) => schema !== undefined);
  const uploads = route.upload === undefined ? [] : UPLOAD_REFUSALS;

  const codes = new Set([
    ...(route.errors ?? []),
    ...(validatesInput ? [VALIDATION_FAILED] : []),
    ...uploads,
    ...(representations === undefined ? [] : negotiationCodes(route)),
    ...preconditionCodes(route),
  ]);

  const codesByStatus = new Map<number, string[]>();

  for (const code of codes) {
    const status = mapper.statusOf(code);

    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }

  return codesByStatus;
}

/**
 * Under negotiation, a route whose answer a representation writes refuses an `Accept` header it
 * cannot meet with 406, and a route that reads a body refuses a media type it does not read with
 * 415, whatever it declares in `produces` and `consumes`.
 */
function negotiationCodes(route: Route): readonly string[] {
  const readsBody = route.request?.body !== undefined && route.upload === undefined && route.rawBody !== true;

  return [...(answersWithSchema(route) ? [NOT_ACCEPTABLE] : []), ...(readsBody ? [UNSUPPORTED_MEDIA_TYPE] : [])];
}

function preconditionCodes({ ifMatch }: Route): readonly string[] {
  if (ifMatch === undefined) {
    return [];
  }

  return ifMatch === IfMatch.required ? [PRECONDITION_FAILED, PRECONDITION_REQUIRED] : [PRECONDITION_FAILED];
}
