/** What a method of a Nest controller answers, as its signature says it. */
export type NestAnswer =
  | { readonly kind: 'none' }
  | { readonly kind: 'accepted' }
  | { readonly kind: 'class'; readonly name: string; readonly specifier: string }
  /** A type the kit cannot turn into a schema (an array, a type written inline, an interface), or no type at all. */
  | { readonly kind: 'unread'; readonly text: string };
