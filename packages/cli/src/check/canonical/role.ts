export interface Role {
  /** Directory relative to the context; `*` stands for one open use-case level. */
  readonly directory: string;
  /** Accepted file suffixes; empty when the role only requires kebab-case. */
  readonly suffixes: readonly string[];
  /** Whole file names the role accepts besides its suffixes: the code list `codes.ts` of `domain/errors`. */
  readonly files?: readonly string[];
  /** Counted by naming/one-concept-per-file when true. */
  readonly oneConcept?: boolean;
  /** Files of the role that stay one per context once it is divided into modules of the model; `<context>` stands for its name. */
  readonly perContext?: readonly string[];
  /** Suffixes whose files need a spec (test/spec-required). */
  readonly specFor?: readonly string[];
}
