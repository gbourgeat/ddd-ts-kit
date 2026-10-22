import { cacheControlOf } from '../cache/cache-control-of';
import { CacheScope } from '../cache/cache-scope';
import { varyOf } from '../cache/vary-of';
import type { Route } from '../route/route';

const NO_STORE = { 'cache-control': CacheScope.noStore };
const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;

/**
 * The caching headers of an answer: those of the policy of the route for a success; `no-store`
 * for a refusal, and for any answer of a route that knows its caller and declares no policy. A
 * public route that declares none says nothing, as before policies existed. An answer a cache may
 * keep varies on the headers the tenant is read from too (`tenantHeaders`, from `resolveTenant`).
 */
export function cacheHeadersOf(
  route: Route,
  status: number,
  tenantHeaders: readonly string[] = [],
): Record<string, string> {
  const { cache } = route;

  if (cache === undefined) {
    return route.security === false ? {} : NO_STORE;
  }

  if (status < SUCCESS_FROM || status > SUCCESS_TO) {
    return NO_STORE;
  }

  const vary = cache.scope === CacheScope.noStore ? (cache.vary ?? []) : varyOf(cache.vary ?? [], tenantHeaders);

  return { 'cache-control': cacheControlOf(cache), ...(vary.length === 0 ? {} : { vary: vary.join(', ') }) };
}
