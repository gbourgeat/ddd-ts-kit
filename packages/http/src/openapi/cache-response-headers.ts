import type { JsonSchema } from '@ddd-ts-kit/validation';
import { cacheHeadersOf } from '../pipeline/cache-headers-of.js';
import type { Route } from '../route/route.js';

const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;

const NAMES: Readonly<Record<string, string>> = { 'cache-control': 'Cache-Control', vary: 'Vary' };

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  'cache-control': 'How the caches on the way may keep this answer.',
  vary: 'The request headers this answer depends on, besides the URL.',
};

const ETAG = { description: 'The version of this answer, to send back in If-None-Match.', schema: { type: 'string' } };

const LAST_MODIFIED = {
  description: 'When the resource last changed, to send back in If-Modified-Since.',
  schema: { type: 'string' },
};

/** The caching headers of a declared answer, as the pipeline sends them: `{}` when it sends none. */
export function cacheResponseHeaders(route: Route, status: number): { headers?: JsonSchema } {
  const headers = { ...sentHeaders(route, status), ...validatorHeaders(route, status) };

  return Object.keys(headers).length === 0 ? {} : { headers };
}

function sentHeaders(route: Route, status: number): JsonSchema {
  return Object.fromEntries(
    Object.entries(cacheHeadersOf(route, status)).map(([name, value]) => [
      NAMES[name] ?? name,
      { description: DESCRIPTIONS[name] ?? name, schema: { type: 'string', const: value } },
    ]),
  );
}

function validatorHeaders(route: Route, status: number): JsonSchema {
  const { cache } = route;

  if (cache === undefined || status < SUCCESS_FROM || status > SUCCESS_TO) {
    return {};
  }

  return {
    ...(cache.etag === undefined ? {} : { ETag: ETAG }),
    ...(cache.lastModified === undefined ? {} : { 'Last-Modified': LAST_MODIFIED }),
  };
}
