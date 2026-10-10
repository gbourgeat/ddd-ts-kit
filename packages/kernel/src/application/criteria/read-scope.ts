/**
 * What an actor may read of one resource type. The `AccessScope` an authorizer of
 * `@ddd-ts-kit/auth` computes has this shape; the kernel names it so that a criteria is
 * narrowed without depending on an authorization model.
 */
export type ReadScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ids'; readonly ids: readonly string[] }
  | { readonly kind: 'filter'; readonly filter: Readonly<Record<string, string | number | boolean>> };
