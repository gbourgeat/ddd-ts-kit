import type { CachePolicy } from '../cache/cache-policy.js';
import type { RawHeaders } from '../route/raw-headers.js';
import type { Route } from '../route/route.js';
import { entityTagOf } from './entity-tag-of.js';
import { isNotModified } from './is-not-modified.js';
import { lastModifiedOf } from './last-modified-of.js';
import type { RouteResponse } from './route-response.js';

const NOT_MODIFIED = 304;
const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;
const READS: readonly string[] = ['GET', 'HEAD'];

/**
 * A successful read that declares validators answers its `ETag` and `Last-Modified`, and
 * `304 Not Modified` without a body when the caller already holds that version. A header the
 * handler answered itself wins. A version and an instant are read from `value`, what the handler
 * answered, whatever representation wrote it; a strong `ETag` digests the bytes sent, so an
 * answer streamed as it is written, whose bytes are not known when its headers go, has none.
 */
export async function conditionalAnswer(
  route: Pick<Route, 'method' | 'cache'>,
  request: Readonly<RawHeaders>,
  answered: { readonly response: RouteResponse; readonly value: unknown },
): Promise<RouteResponse> {
  const { cache } = route;
  const { response, value } = answered;

  if (cache === undefined || response.status < SUCCESS_FROM || response.status > SUCCESS_TO) {
    return response;
  }

  const headers = { ...(await validatorsOf(cache, response, value)), ...response.headers };

  if (!READS.includes(route.method) || !isNotModified(request, headers)) {
    return { ...response, headers };
  }

  return {
    status: NOT_MODIFIED,
    headers: Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'content-type')),
  };
}

async function validatorsOf(
  cache: CachePolicy,
  response: RouteResponse,
  value: unknown,
): Promise<Record<string, string>> {
  const streamed = response.stream !== undefined && cache.etag === 'representation';

  return {
    ...(cache.etag === undefined || streamed ? {} : { etag: await entityTagOf(cache.etag, response, value) }),
    ...(cache.lastModified === undefined ? {} : { 'last-modified': lastModifiedOf(cache.lastModified, value) }),
  };
}
