import type { Rewrite } from './rewrite.js';

export type Resolution =
  | { readonly kind: 'relation'; readonly subjects: readonly string[] }
  | { readonly kind: 'permission'; readonly rewrite: Rewrite };
