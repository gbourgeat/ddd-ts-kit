import { cacheControlOf } from '../cache/cache-control-of.js';
import { CacheScope } from '../cache/cache-scope.js';
import type { Route } from '../route/route.js';

const NO_STORE = { 'cache-control': CacheScope.noStore };
const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;

/**
 * The caching headers of an answer: those of the policy of the route for a success; `no-store`
 * for a refusal, and for any answer of a route that knows its caller and declares no policy. A
 * public route that declares none says nothing, as before policies existed.
 */
export function cacheHeadersOf(route: Route, status: number): Record<string, string> {
  const { cache } = route;

  if (cache === undefined) {
    return route.security === false ? {} : NO_STORE;
  }

  if (status < SUCCESS_FROM || status > SUCCESS_TO) {
    return NO_STORE;
  }

  const vary = cache.vary ?? [];

  return { 'cache-control': cacheControlOf(cache), ...(vary.length === 0 ? {} : { vary: vary.join(', ') }) };
}
