import type { Location } from './location';

export type ImportTarget =
  | { readonly kind: 'file'; readonly path: string; readonly location: Location }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };
