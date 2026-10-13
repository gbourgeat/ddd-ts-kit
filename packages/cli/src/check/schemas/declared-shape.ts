/** A shape of the HTTP contract written by hand: a DTO class, or the object of a schema builder. */
export interface DeclaredShape {
  /** The shape, written the same way whatever its layout: equal keys are one shape. */
  readonly key: string;
  readonly line: number;
  /** How a reader finds it in its file. */
  readonly what: string;
}
