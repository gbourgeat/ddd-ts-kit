import type { MergeFinding } from './merge-finding.js';
import type { MergeSides } from './merge-sides.js';

const OPENING = /^<{7}(?: |$)/;
const BASE = /^\|{7}(?: |$)/;
const SEPARATOR = /^={7}$/;
const CLOSING = /^>{7}(?: |$)/;

/**
 * The conflict markers left in the files of a result, each line where it stands. A separator
 * counts only inside an opened conflict (`=======` alone underlines a title in reStructuredText),
 * and a file whose sides already hold as many opening markers as the result (a fixture, a
 * document about git) is passed over.
 */
export function conflictMarkers({ ours, theirs, result }: MergeSides): MergeFinding[] {
  return [...result]
    .filter(([file, content]) => openings(content) > Math.max(openings(ours.get(file)), openings(theirs.get(file))))
    .flatMap(([file, content]) => markersOf(file, content));
}

function openings(content: string | undefined): number {
  return (content ?? '').split('\n').filter((line) => OPENING.test(line)).length;
}

function markersOf(file: string, content: string): MergeFinding[] {
  const markers: MergeFinding[] = [];
  let open = false;

  for (const [index, text] of content.split('\n').entries()) {
    const opening = OPENING.test(text);
    const marker = opening || CLOSING.test(text) || (open && (BASE.test(text) || SEPARATOR.test(text)));

    open = opening || (open && !CLOSING.test(text));

    if (marker) {
      markers.push({ kind: 'conflict-marker', file, line: index + 1, side: 'result', text: text.trimEnd() });
    }
  }

  return markers;
}
