/** What one changed path reaches: one context (its specs alone when only its tests changed), everything, or nothing that runs. */
export type PathReach =
  | { readonly kind: 'context'; readonly context: string; readonly testsOnly: boolean }
  | { readonly kind: 'everything'; readonly reason: string }
  | { readonly kind: 'nothing' };
