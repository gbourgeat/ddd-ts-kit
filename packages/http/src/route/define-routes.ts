import { assertUniqueRoutes } from './assert-unique-routes.js';
import type { Route } from './route.js';

/** Gathers routes (or groups of routes) into one list and refuses duplicates. */
export function defineRoutes(...routes: readonly (Route | readonly Route[])[]): readonly Route[] {
  const flat = routes.flatMap((entry): readonly Route[] => (isRouteList(entry) ? entry : [entry]));

  assertUniqueRoutes(flat);

  return flat;
}

function isRouteList(entry: Route | readonly Route[]): entry is readonly Route[] {
  return Array.isArray(entry);
}
