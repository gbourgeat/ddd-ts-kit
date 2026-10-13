import type { JsonSchema } from '@ddd-ts-kit/validation';
import { IfMatch } from '../cache/if-match.js';
import type { ErrorMapper } from '../error/error-mapper.js';
import { statusTitle } from '../error/status-title.js';
import type { ResponseSpec } from '../route/response-spec.js';
import type { Route } from '../route/route.js';
import { isRecord } from '../support/is-record.js';
import { cacheResponseHeaders } from './cache-response-headers.js';
import { compare } from './compare.js';
import type { Definitions } from './definitions.js';

const VALIDATION_FAILED = 'VALIDATION_FAILED';
const PRECONDITION_FAILED = 'PRECONDITION_FAILED';
const PRECONDITION_REQUIRED = 'PRECONDITION_REQUIRED';
const NOT_MODIFIED = 304;
/** What a route that declares an upload may answer besides its own codes: a file too large, of another type, or missing. */
const UPLOAD_REFUSALS = ['FILE_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', VALIDATION_FAILED];
const PROBLEM_REF = { $ref: '#/components/schemas/Problem' };

/** The declared responses, plus one problem response per status of the declared error codes. */
export function responses(route: Route, mapper: ErrorMapper, definitions: Definitions): JsonSchema {
  const byStatus = declaredResponses(route, definitions);

  if (route.cache?.etag !== undefined || route.cache?.lastModified !== undefined) {
    byStatus.set(NOT_MODIFIED, {
      description:
        'Not Modified: the version the caller holds (If-None-Match, If-Modified-Since) is still the current one.',
    });
  }

  for (const [status, codes] of errorCodesByStatus(route, mapper)) {
    byStatus.set(status, problemResponse(status, codes, byStatus.get(status)));
  }

  const statuses = [...byStatus.keys()].sort((a, b) => a - b);

  return Object.fromEntries(statuses.map((status) => [String(status), byStatus.get(status)]));
}

function declaredResponses(route: Route, definitions: Definitions): Map<number, JsonSchema> {
  const byStatus = new Map<number, JsonSchema>();
  // A copy has a string index, which is how the statuses are enumerated.
  const declaredByKey: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

  for (const [key, declared] of Object.entries(declaredByKey)) {
    byStatus.set(Number(key), {
      description: declared.description,
      ...cacheResponseHeaders(route, Number(key)),
      ...(declared.body === undefined
        ? {}
        : { content: { 'application/json': { schema: definitions.embed(declared.body) } } }),
    });
  }

  return byStatus;
}

function errorCodesByStatus(route: Route, mapper: ErrorMapper): Map<number, string[]> {
  const validatesInput = Object.values(route.request ?? {}).some((schema) => schema !== undefined);
  const uploads = route.upload === undefined ? [] : UPLOAD_REFUSALS;

  const codes = new Set([
    ...(route.errors ?? []),
    ...(validatesInput ? [VALIDATION_FAILED] : []),
    ...uploads,
    ...preconditionCodes(route),
  ]);

  const codesByStatus = new Map<number, string[]>();

  for (const code of codes) {
    const status = mapper.statusOf(code);

    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }

  return codesByStatus;
}

function preconditionCodes({ ifMatch }: Route): readonly string[] {
  if (ifMatch === undefined) {
    return [];
  }

  return ifMatch === IfMatch.required ? [PRECONDITION_FAILED, PRECONDITION_REQUIRED] : [PRECONDITION_FAILED];
}

function problemResponse(status: number, codes: readonly string[], declared: JsonSchema | undefined): JsonSchema {
  const sorted = [...codes].sort(compare);

  return {
    description:
      declared === undefined ? `${statusTitle(status)}. Error codes: ${sorted.join(', ')}.` : declared['description'],
    content: {
      ...(isRecord(declared?.['content']) ? declared['content'] : {}),
      'application/problem+json': { schema: PROBLEM_REF },
    },
    'x-error-codes': sorted,
  };
}
