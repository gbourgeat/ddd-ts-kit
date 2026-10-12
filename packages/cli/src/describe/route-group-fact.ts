/** A route group as its decorator and the groups above it say it. */
export interface RouteGroupFact {
  readonly name: string;
  /** The prefixes of its parents and its own, joined. */
  readonly prefix: string;
  /** The guards of its parents, then its own, as written. */
  readonly guards: readonly string[];
  readonly errors: readonly string[];
  readonly tags: readonly string[];
}
