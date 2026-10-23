import type { DocumentPart } from './document-part';

/** Which parts to judge: those linked to one of `rows`, and with `unlinked` those linked to no row. */
export interface PartSelection {
  readonly rows: ReadonlySet<string>;
  readonly unlinked: boolean;
}

/** The parts a selection judges, each linked to the rows of the selection only. A part of rows outside it is never judged. */
export function selectParts(parts: readonly DocumentPart[], selection: PartSelection): DocumentPart[] {
  return parts.flatMap((part) => {
    if (part.rows.length === 0) {
      return selection.unlinked ? [part] : [];
    }

    const rows = part.rows.filter((id) => selection.rows.has(id));

    return rows.length > 0 ? [{ ...part, rows }] : [];
  });
}
