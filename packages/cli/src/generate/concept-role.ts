/** A name the same command writes besides the one judged, typed as words (`order read`). */
export interface Alongside {
  readonly words: string;
  /** What it is, for the parsing of its words (`permission`). */
  readonly what: string;
  /** How a refusal calls it: `the permission "order.read"`. */
  readonly label: string;
}

export interface ConceptRole {
  readonly what: string;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
  /** The words of these the glossary lacks, and their technical words, are refused in the same message, not one run later. */
  readonly alongside?: readonly Alongside[];
}
