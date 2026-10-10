/** What one purity/* rule forbids in domain/ and application/. */
export interface PurityRule {
  readonly id: string;
  readonly description: string;
  readonly code: readonly { readonly pattern: RegExp; readonly what: string }[];
  /** Bare packages and Node built-ins (without the `node:` prefix) that give the same access. */
  readonly modules: readonly string[];
  readonly fix: string;
}
