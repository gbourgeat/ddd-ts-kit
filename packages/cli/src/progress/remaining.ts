/** Something a generator left for the team: a decision of the domain, a choice of the platform, or a test to write. */
export interface Remaining {
  /** `domain` for `TODO(domain)`, `platform` for `TODO(platform)`, `test` for `it.todo`. */
  readonly kind: 'domain' | 'platform' | 'test';
  /** The context the file belongs to; empty outside the contexts. */
  readonly context: string;
  readonly file: string;
  readonly line: number;
  readonly text: string;
}
