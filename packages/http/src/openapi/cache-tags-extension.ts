import type { CacheTagSource } from '../cache/cache-tag-source';
import type { Route } from '../route/route';

/**
 * `x-cache-tags`: the tags an answer is filed under, as templates (`calendar:{calendarId}`,
 * `appointment:{items.id}`, `appointment`), for whoever runs the shared cache in front of the API.
 */
export function cacheTagsExtension(route: Route): { 'x-cache-tags'?: string[] } {
  const sources = route.cache?.tags ?? [];

  return sources.length === 0 ? {} : { 'x-cache-tags': sources.map(templateOf) };
}

function templateOf(source: CacheTagSource): string {
  if ('param' in source) {
    return `${source.resource}:{${source.param}}`;
  }

  return 'field' in source ? `${source.resource}:{${source.field}}` : source.resource;
}
