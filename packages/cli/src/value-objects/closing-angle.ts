/**
 * Offset of the `>` closing the `<` at `open` in scanned code, an arrow `=>` not counted; the
 * end of the text when there is none.
 */
export function closingAngle(code: string, open: number): number {
  let depth = 0;

  for (let i = open; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (char === '<') {
      depth += 1;
    } else if (char === '>' && code.charAt(i - 1) !== '=' && (depth -= 1) === 0) {
      return i;
    }
  }

  return code.length - 1;
}
