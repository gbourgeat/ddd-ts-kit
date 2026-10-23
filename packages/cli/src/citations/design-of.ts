import { SLICES_FILE } from '../progress/read-slices';
import type { DocumentPart } from './document-part';

/** A document, or one section of it, that holds part of the design of a row. */
export interface DesignDocument {
  readonly document: string;
  readonly section?: string;
}

/** The documents other than the slices file that hold part of the design of a row, each once. */
export function designOf(parts: readonly DocumentPart[], id: string): DesignDocument[] {
  return parts
    .filter((part) => part.document !== SLICES_FILE && part.rows.includes(id))
    .map(({ document, section }) => (section === undefined ? { document } : { document, section }));
}
