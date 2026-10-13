/** Where the body of a function lies in blanked code: a block between braces, or the expression an arrow answers. */
export type FunctionBody =
  | { readonly kind: 'block'; readonly open: number; readonly close: number }
  | { readonly kind: 'expression'; readonly start: number };
