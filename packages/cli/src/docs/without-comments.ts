const OPEN = '<!--';
const CLOSE = '-->';

/**
 * `text` without its HTML comments. A comment left open runs to the end, and the search starts
 * again after each removal, so the result never holds `<!--`.
 */
export function withoutComments(text: string): string {
  let rest = text;
  let open = rest.indexOf(OPEN);

  while (open !== -1) {
    const close = rest.indexOf(CLOSE, open + OPEN.length);

    rest = rest.slice(0, open) + (close === -1 ? '' : rest.slice(close + CLOSE.length));
    open = rest.indexOf(OPEN, Math.max(0, open - OPEN.length));
  }

  return rest;
}
