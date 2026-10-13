/** A simple condition on another field of the same form: equal to one value, or to one of several. */
export type FormCondition =
  | { readonly field: string; readonly equals: string | number | boolean }
  | { readonly field: string; readonly in: readonly (string | number | boolean)[] };
