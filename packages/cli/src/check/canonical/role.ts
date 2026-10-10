export interface Role {
  /** Directory relative to the context; `*` stands for one open use-case level. */
  readonly directory: string;
  /** Accepted file suffixes; empty when the role only requires kebab-case. */
  readonly suffixes: readonly string[];
  /** Counted by naming/one-concept-per-file when true. */
  readonly oneConcept?: boolean;
  /** Suffixes whose files need a spec (test/spec-required). */
  readonly specFor?: readonly string[];
}
