import type { Scan } from '../check/scan/scan';
import { blank } from '../check/scan/blank';

/** The source with its comments blanked and everything else as written, strings and expressions alike: offsets are preserved. */
export function commentless(source: string, scanned: Scan): string {
  const ranges = [...lineComments(source, scanned), ...blockComments(source, scanned)].sort(
    ([left], [right]) => left - right,
  );

  let text = '';
  let at = 0;

  for (const [start, end] of ranges) {
    text += source.slice(at, start) + blank(source.slice(start, end));
    at = end;
  }

  return text + source.slice(at);
}

/** A line comment runs from the first `//` of its line after which the code is blank, to the end of the line. */
function lineComments(source: string, { code, comments }: Scan): Array<[number, number]> {
  return comments.map(({ end }) => {
    const lineStart = source.lastIndexOf('\n', end - 1) + 1;
    let start = source.indexOf('//', lineStart);

    while (start !== -1 && start < end && code.slice(start, end).trim() !== '') {
      start = source.indexOf('//', start + 1);
    }

    return [start === -1 || start >= end ? end : start, end];
  });
}

/** A block comment is its opening delimiter, its text, then its closing one unless it is left open at the end of the file. */
function blockComments(source: string, { blockComments: comments }: Scan): Array<[number, number]> {
  return comments.map(({ text, end }) => {
    const closing = source.endsWith('*/', end) && end - text.length >= 4 ? 2 : 0;

    return [end - closing - text.length - 2, end];
  });
}
