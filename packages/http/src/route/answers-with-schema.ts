import type { ResponseSpec } from './response-spec.js';
import type { Route } from './route.js';

/**
 * Whether a representation writes what the route answers: a route that declares no body schema
 * answers its own bytes (a file, a redirect, no content), which no `Accept` header refuses.
 */
export function answersWithSchema(route: Pick<Route, 'responses'>): boolean {
  // A copy has a string index, which is how the statuses are enumerated.
  const declared: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

  return Object.values(declared).some(({ body }) => body !== undefined);
}
