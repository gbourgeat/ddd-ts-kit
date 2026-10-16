/** Something left for the team: a decision of the domain, a choice of the platform, a test to write, or a remark of a review to settle. */
export interface Remaining {
  /** `domain` for `TODO(domain)`, `platform` for `TODO(platform)`, `test` for `it.todo`, `review` for `TODO(review)`. */
  readonly kind: 'domain' | 'platform' | 'test' | 'review';
  /** The context the file belongs to; empty outside the contexts. */
  readonly context: string;
  readonly file: string;
  readonly line: number;
  readonly text: string;
}
