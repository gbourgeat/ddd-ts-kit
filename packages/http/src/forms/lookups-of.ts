import type { Route } from '../route/route';
import type { FieldLookup } from './field-lookup';

/** The `GET` routes a field may take its options from, by operation id. */
export function lookupsOf(routes: readonly Route[]): ReadonlyMap<string, FieldLookup> {
  return new Map(
    routes
      .filter((route) => route.method === 'GET')
      .map((route) => [route.operationId, { operation: route.operationId, method: 'GET', path: route.path }]),
  );
}
