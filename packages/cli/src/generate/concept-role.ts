export interface ConceptRole {
  readonly what: string;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
  /**
   * Names the same command writes besides this one, typed as words (`order read`): the words of
   * them the glossary lacks are refused in the same message, not one run later.
   */
  readonly alongside?: readonly string[];
}
