import type { TokenReference } from './token-reference';

/** The class a constructor parameter names, or why it names none. */
export type ResolvedToken =
  | { readonly token: TokenReference; readonly flaw?: undefined }
  | { readonly flaw: string; readonly token?: undefined };
