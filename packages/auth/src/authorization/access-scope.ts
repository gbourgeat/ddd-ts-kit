/**
 * What an actor may read of one resource type, in a form a read port turns into a `WHERE`
 * clause. A list is filtered by the query, never in memory after loading.
 */
export type AccessScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ids'; readonly ids: readonly string[] }
  | { readonly kind: 'filter'; readonly filter: Readonly<Record<string, string | number | boolean>> };
