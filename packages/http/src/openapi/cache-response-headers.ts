import type { JsonSchema } from '@ddd-ts-kit/validation';
import { cacheHeadersOf } from '../pipeline/cache-headers-of.js';
import type { Route } from '../route/route.js';

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  'cache-control': 'How the caches on the way may keep this answer.',
  vary: 'The request headers this answer depends on, besides the URL.',
};

const NAMES: Readonly<Record<string, string>> = { 'cache-control': 'Cache-Control', vary: 'Vary' };

/** The caching headers of a declared answer, as the pipeline sends them: `{}` when it sends none. */
export function cacheResponseHeaders(route: Route, status: number): { headers?: JsonSchema } {
  const sent = Object.entries(cacheHeadersOf(route, status));

  if (sent.length === 0) {
    return {};
  }

  return {
    headers: Object.fromEntries(
      sent.map(([name, value]) => [
        NAMES[name] ?? name,
        { description: DESCRIPTIONS[name] ?? name, schema: { type: 'string', const: value } },
      ]),
    ),
  };
}
