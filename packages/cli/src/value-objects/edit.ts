/** A replacement of the text between two offsets of a source. */
export interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}
