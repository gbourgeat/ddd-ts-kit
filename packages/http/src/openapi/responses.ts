import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { ErrorMapper } from '../error/error-mapper.js';
import { statusTitle } from '../error/status-title.js';
import { NOT_ACCEPTABLE } from '../representation/not-acceptable-error.js';
import { UNSUPPORTED_MEDIA_TYPE } from '../representation/unsupported-media-type-error.js';
import type { ResponseSpec } from '../route/response-spec.js';
import type { Route } from '../route/route.js';
import { isRecord } from '../support/is-record.js';
import { compare } from './compare.js';
import type { Documenting } from './documenting.js';

const VALIDATION_FAILED = 'VALIDATION_FAILED';
/** What a route that declares an upload may answer besides its own codes: a file too large, of another type, or missing. */
const UPLOAD_REFUSALS = ['FILE_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', VALIDATION_FAILED];
const PROBLEM_REF = { $ref: '#/components/schemas/Problem' };

/** The declared responses, plus one problem response per status of the declared error codes. */
export function responses(route: Route, documenting: Documenting): JsonSchema {
  const byStatus = declaredResponses(route, documenting);
  const problemTypes = problemMediaTypes(route, documenting);

  for (const [status, codes] of errorCodesByStatus(route, documenting.mapper)) {
    byStatus.set(status, problemResponse({ status, codes, mediaTypes: problemTypes }, byStatus.get(status)));
  }

  const statuses = [...byStatus.keys()].sort((a, b) => a - b);

  return Object.fromEntries(statuses.map((status) => [String(status), byStatus.get(status)]));
}

function declaredResponses(route: Route, { definitions, representations }: Documenting): Map<number, JsonSchema> {
  const byStatus = new Map<number, JsonSchema>();
  const mediaTypes = representations.offeredBy(route);
  // A copy has a string index, which is how the statuses are enumerated.
  const declaredByKey: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

  for (const [key, declared] of Object.entries(declaredByKey)) {
    byStatus.set(Number(key), {
      description: declared.description,
      ...(declared.body === undefined ? {} : { content: contentOf(mediaTypes, definitions.embed(declared.body)) }),
    });
  }

  return byStatus;
}

function contentOf(mediaTypes: readonly string[], schema: JsonSchema): JsonSchema {
  return Object.fromEntries(mediaTypes.map((mediaType) => [mediaType, { schema }]));
}

/** `application/problem+json`, and the problem type of every media type the route answers in that has one. */
function problemMediaTypes(route: Route, { representations }: Documenting): readonly string[] {
  const types = representations.offeredBy(route).map((mediaType) => representations.problemIn(mediaType).mediaType);

  return [...new Set(types)];
}

function errorCodesByStatus(route: Route, mapper: ErrorMapper): Map<number, string[]> {
  const validatesInput = Object.values(route.request ?? {}).some((schema) => schema !== undefined);
  const uploads = route.upload === undefined ? [] : UPLOAD_REFUSALS;

  const codes = new Set([
    ...(route.errors ?? []),
    ...(validatesInput ? [VALIDATION_FAILED] : []),
    ...uploads,
    ...negotiationCodes(route),
  ]);

  const codesByStatus = new Map<number, string[]>();

  for (const code of codes) {
    const status = mapper.statusOf(code);

    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }

  return codesByStatus;
}

/** A route that answers in several media types may answer 406; one that reads several, 415. */
function negotiationCodes(route: Route): readonly string[] {
  return [
    ...((route.produces ?? []).length > 0 ? [NOT_ACCEPTABLE] : []),
    ...((route.consumes ?? []).length > 0 ? [UNSUPPORTED_MEDIA_TYPE] : []),
  ];
}

interface Refusals {
  readonly status: number;
  readonly codes: readonly string[];
  readonly mediaTypes: readonly string[];
}

function problemResponse({ status, codes, mediaTypes }: Refusals, declared: JsonSchema | undefined): JsonSchema {
  const sorted = [...codes].sort(compare);

  return {
    description:
      declared === undefined ? `${statusTitle(status)}. Error codes: ${sorted.join(', ')}.` : declared['description'],
    content: {
      ...(isRecord(declared?.['content']) ? declared['content'] : {}),
      ...contentOf(mediaTypes, PROBLEM_REF),
    },
    'x-error-codes': sorted,
  };
}
