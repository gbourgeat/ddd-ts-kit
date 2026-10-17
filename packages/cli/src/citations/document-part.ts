/** A piece of text of a document read as one: a paragraph, a heading, a table row or a cell, with the line it starts on. */
export interface PartText {
  readonly line: number;
  readonly text: string;
}

/** A part of a design document, with the rows of the slices table it belongs to. */
export interface DocumentPart {
  /** Relative to the project root. */
  readonly document: string;
  /** The heading of the section, when the part is one section of the document. */
  readonly section?: string;
  /** The ids of the rows linked to the part; empty when nothing links it. */
  readonly rows: readonly string[];
  /** Its text, fenced blocks left out. */
  readonly texts: readonly PartText[];
}
