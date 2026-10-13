import { CacheScope } from '../cache/cache-scope.js';
import { CacheTagHeader } from '../cache/cache-tag-header.js';
import type { Route } from '../route/route.js';
import { cacheTagsOf, type TaggedParts } from './cache-tags-of.js';
import type { RouteResponse } from './route-response.js';

/**
 * What tags an answer: the route, the header of the shared cache, and what the tags are read
 * from, the value the handler answered among them, before any representation wrote it.
 */
export interface Tagging extends TaggedParts {
  readonly route: Pick<Route, 'cache'>;
  readonly header: CacheTagHeader | undefined;
  /** Whether the tags are filed under the tenant of the request (`cacheTags.perTenant`). */
  readonly perTenant: boolean;
}

const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;
const COMMA_SEPARATED: readonly CacheTagHeader[] = [CacheTagHeader.cacheTag, CacheTagHeader.cdnTag];

/**
 * A successful public answer that declares the resources it shows carries their tags, in the
 * header the shared cache of the application reads them from. Nothing when the application names
 * no header: a private or uncached answer never reaches a shared cache. When the tags are filed
 * per tenant and the request names none, no purge could ever meet the answer: nobody keeps it.
 */
export function taggedAnswer(response: RouteResponse, tagging: Tagging): RouteResponse {
  const { route, header, perTenant, ...parts } = tagging;
  const { cache } = route;

  if (header === undefined || cache?.scope !== CacheScope.public || cache.tags === undefined || !succeeded(response)) {
    return response;
  }

  if (perTenant && parts.tenantId === undefined) {
    return { ...response, headers: { ...response.headers, 'cache-control': CacheScope.noStore } };
  }

  const tags = cacheTagsOf(cache.tags, parts);

  if (tags.length === 0) {
    return response;
  }

  const separator = COMMA_SEPARATED.includes(header) ? ',' : ' ';

  return { ...response, headers: { [header]: tags.join(separator), ...response.headers } };
}

function succeeded({ status }: RouteResponse): boolean {
  return status >= SUCCESS_FROM && status <= SUCCESS_TO;
}
