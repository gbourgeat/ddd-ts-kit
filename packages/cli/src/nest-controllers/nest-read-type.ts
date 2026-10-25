/** A type of a signature the kit turns into a schema, a DTO class, or one it cannot read, as written. */
export type NestReadType =
  | { readonly kind: 'class'; readonly name: string; readonly specifier: string }
  /** A type the kit cannot turn into a schema (an array, a type written inline, an interface), or no type at all. */
  | { readonly kind: 'unread'; readonly text: string };
