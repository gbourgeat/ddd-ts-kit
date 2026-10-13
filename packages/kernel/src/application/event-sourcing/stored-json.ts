/** A value an event store keeps as it is: plain JSON. */
export type StoredJson =
  | string
  | number
  | boolean
  | null
  | readonly StoredJson[]
  | { readonly [key: string]: StoredJson };
