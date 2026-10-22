import type { Route } from './route';
import { withoutTrailingSlashes } from './without-trailing-slashes';

/** Returns the same routes under a path prefix, for the server and for the contract alike. */
export function prefixRoutes(prefix: string, routes: readonly Route[]): readonly Route[] {
  const base = withoutTrailingSlashes(prefix);

  return routes.map((route) => ({
    ...route,
    path: route.path === '/' ? (base === '' ? '/' : base) : `${base}${route.path}`,
  }));
}
