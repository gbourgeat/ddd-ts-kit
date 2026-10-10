/** A part of a list split on its top-level commas, trimmed, with the offset it starts at in the text given. */
export interface ListPart {
  readonly code: string;
  readonly start: number;
}
