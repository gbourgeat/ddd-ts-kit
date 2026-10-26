import type { JsonSchema } from '@ddd-ts-kit/validation';
import { refusalCodesByStatus } from '../error/refusal-codes-by-status';
import { statusTitle } from '../error/status-title';
import { answersWithSchema } from '../route/answers-with-schema';
import type { ResponseSpec } from '../route/response-spec';
import type { Route } from '../route/route';
import { isRecord } from '../support/is-record';
import { cacheResponseHeaders } from './cache-response-headers';
import { compare } from './compare';
import type { Documenting } from './documenting';

const NOT_MODIFIED = 304;
const PROBLEM_REF = { $ref: '#/components/schemas/Problem' };
const JSON_MEDIA_TYPE = 'application/json';
const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/** The declared responses, plus one problem response per status of the declared error codes. */
export function responses(route: Route, documenting: Documenting): JsonSchema {
  const byStatus = declaredResponses(route, documenting);
  const problemTypes = problemMediaTypes(route, documenting);

  if (route.cache?.etag !== undefined || route.cache?.lastModified !== undefined) {
    byStatus.set(NOT_MODIFIED, {
      description:
        'Not Modified: the version the caller holds (If-None-Match, If-Modified-Since) is still the current one.',
    });
  }

  for (const [status, codes] of refusalCodesByStatus(route, documenting.mapper, documenting.representations)) {
    byStatus.set(status, problemResponse({ status, codes, mediaTypes: problemTypes }, byStatus.get(status)));
  }

  const statuses = [...byStatus.keys()].sort((a, b) => a - b);

  return Object.fromEntries(statuses.map((status) => [String(status), byStatus.get(status)]));
}

function declaredResponses(route: Route, { definitions, representations }: Documenting): Map<number, JsonSchema> {
  const byStatus = new Map<number, JsonSchema>();
  const mediaTypes = representations?.offeredBy(route) ?? [JSON_MEDIA_TYPE];
  // An answer chosen by Accept among several media types varies on it, as the pipeline says.
  const varies = representations !== undefined && answersWithSchema(route) && mediaTypes.length > 1;
  // A copy has a string index, which is how the statuses are enumerated.
  const declaredByKey: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

  for (const [key, declared] of Object.entries(declaredByKey)) {
    byStatus.set(Number(key), {
      description: declared.description,
      ...headersOf(declared, cacheResponseHeaders(route, Number(key), varies)),
      ...(declared.body === undefined ? {} : { content: contentOf(mediaTypes, definitions.embed(declared.body)) }),
    });
  }

  return byStatus;
}

/** The headers the answer is declared to carry, beside the caching headers the pipeline sends. */
function headersOf(declared: ResponseSpec, cached: { headers?: JsonSchema }): { headers?: JsonSchema } {
  const written = Object.fromEntries(
    Object.entries(declared.headers ?? {}).map(([name, description]) => [
      name,
      { description, schema: { type: 'string' } },
    ]),
  );

  const headers = { ...written, ...cached.headers };

  return Object.keys(headers).length === 0 ? {} : { headers };
}

function contentOf(mediaTypes: readonly string[], schema: JsonSchema): JsonSchema {
  return Object.fromEntries(mediaTypes.map((mediaType) => [mediaType, { schema }]));
}

/** `application/problem+json`, and the problem type of every media type the route answers in that has one. */
function problemMediaTypes(route: Route, { representations }: Documenting): readonly string[] {
  if (representations === undefined) {
    return [PROBLEM_MEDIA_TYPE];
  }

  const types = representations.offeredBy(route).map((mediaType) => representations.problemIn(mediaType).mediaType);

  return [...new Set(types)];
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
