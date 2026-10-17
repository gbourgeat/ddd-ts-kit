import type { PartText } from './document-part.js';

const FENCE = /^\s{0,3}(?:```|~~~)/;
/** A heading or a table row: a piece of its own, that nothing continues. */
const ALONE = /^\s{0,3}(?:#{1,6}\s|\|)/;
/** A list item starts a piece, that its indented lines continue. */
const ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s/;

/**
 * The pieces of text of consecutive lines of a document, the first one being `firstLine`, fenced
 * blocks left out: a paragraph, a list item, a heading or a table row. A blank line ends a piece.
 */
export function textUnits(lines: readonly string[], firstLine: number): PartText[] {
  const units: PartText[] = [];
  let fenced = false;
  let open = false;

  lines.forEach((content, index) => {
    const fence = FENCE.test(content);

    fenced = fence ? !fenced : fenced;

    const last = units.at(-1);

    if (fence || fenced || content.trim() === '') {
      open = false;
    } else if (open && last !== undefined && !ALONE.test(content) && !ITEM.test(content)) {
      units[units.length - 1] = { line: last.line, text: `${last.text}\n${content}` };
    } else {
      units.push({ line: firstLine + index, text: content });
      open = !ALONE.test(content);
    }
  });

  return units;
}
