export interface ConceptRole {
  readonly what: string;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
}
