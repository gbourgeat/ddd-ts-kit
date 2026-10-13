import { CacheScope } from '../cache/cache-scope.js';
import { CacheTagHeader } from '../cache/cache-tag-header.js';
import type { Route } from '../route/route.js';
import { cacheTagsOf, type TaggedParts } from './cache-tags-of.js';
import type { RouteResponse } from './route-response.js';

/** What tags an answer: the route, the header of the shared cache, and what the tags are read from. */
export interface Tagging extends Omit<TaggedParts, 'body'> {
  readonly route: Pick<Route, 'cache'>;
  readonly header: CacheTagHeader | undefined;
}

const SUCCESS_FROM = 200;
const SUCCESS_TO = 299;
const COMMA_SEPARATED: readonly CacheTagHeader[] = [CacheTagHeader.cacheTag, CacheTagHeader.cdnTag];

/**
 * A successful public answer that declares the resources it shows carries their tags, in the
 * header the shared cache of the application reads them from. Nothing when the application names
 * no header: a private or uncached answer never reaches a shared cache.
 */
export function taggedAnswer(response: RouteResponse, tagging: Tagging): RouteResponse {
  const { route, header, ...parts } = tagging;
  const { cache } = route;

  if (header === undefined || cache?.scope !== CacheScope.public || cache.tags === undefined) {
    return response;
  }

  if (response.status < SUCCESS_FROM || response.status > SUCCESS_TO) {
    return response;
  }

  const tags = cacheTagsOf(cache.tags, { ...parts, body: response.body });

  if (tags.length === 0) {
    return response;
  }

  const separator = COMMA_SEPARATED.includes(header) ? ',' : ' ';

  return { ...response, headers: { [header]: tags.join(separator), ...response.headers } };
}
