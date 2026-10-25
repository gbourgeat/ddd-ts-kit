/** How a strategy of Passport answered one request, through the action it called. */
export type PassportOutcome =
  | { readonly kind: 'success'; readonly user: unknown; readonly info: unknown }
  | { readonly kind: 'fail' }
  | { readonly kind: 'pass' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'redirect'; readonly url: unknown };
