/**
 * The tag a shared cache files an answer under, for the resource it shows: `cacheTag('calendar',
 * 'c-1')` is `calendar:c-1`, `cacheTag('calendar')` names every calendar. The answer and the purge
 * name a resource with the same function, so they always meet. The identifier is percent-encoded:
 * a tag holds no space and no comma, which separate tags in the headers of the caches.
 */
export function cacheTag(resource: string, id?: string | number): string {
  return id === undefined ? resource : `${resource}:${encodeURIComponent(String(id))}`;
}
