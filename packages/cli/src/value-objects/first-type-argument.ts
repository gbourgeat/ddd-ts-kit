const OPENERS = '([{<';
const CLOSERS = ')]}>';

/** Offset of the end of the first argument of the type arguments opened by the `<` at `open`: its top-level comma, or the closing `>`. */
export function firstTypeArgument(code: string, open: number): number {
  let depth = 0;

  for (let i = open; i < code.length; i += 1) {
    const char = code.charAt(i);
    const arrow = char === '>' && code.charAt(i - 1) === '=';

    if (OPENERS.includes(char)) {
      depth += 1;
    } else if (CLOSERS.includes(char) && !arrow) {
      depth -= 1;
    }

    if ((char === ',' && depth === 1) || depth === 0) {
      return i;
    }
  }

  return code.length;
}
