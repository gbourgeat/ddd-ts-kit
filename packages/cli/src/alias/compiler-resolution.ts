/** The compiler options that decide how a specifier is resolved and what the compiler emits for it. */
export interface CompilerResolution {
  readonly module: string;
  readonly moduleResolution: string;
  /** The conditions added to the ones the resolution reads in the `exports` of a package. */
  readonly customConditions?: readonly string[];
}
