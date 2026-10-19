/** One entry of the code list of a context: the refusal class it names, and the code it gives it. */
export interface CodeEntry {
  readonly key: string;
  /** The code when it is written as one string literal; undefined for anything else. */
  readonly code: string | undefined;
  readonly line: number;
}
