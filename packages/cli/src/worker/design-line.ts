import type { BriefedSlice } from './briefed-slice.js';

/** Under a row of the briefing, the documents that hold part of its design; nothing when the slices file holds it all. */
export function designLine({ design }: BriefedSlice): string[] {
  if (design.length === 0) {
    return [];
  }

  const documents = design.map(({ document, section }) =>
    section === undefined ? document : `${document} (section "${section}")`,
  );

  return [`  design: ${documents.join(', ')}`];
}
