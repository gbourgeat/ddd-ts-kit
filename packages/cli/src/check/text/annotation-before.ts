import { typeBrackets } from './type-brackets';

/** A `=` that assigns, at the end of the text before an initializer: not `==`, `!=`, `<=`, `>=`, `+=` and the like. */
const ASSIGNS = /(?<![=!<>+\-*/%&|^?])=\s*$/;
/** The longest annotation looked at. */
const WINDOW = 1000;

/**
 * The type annotating what is initialized by the expression starting at `start`, in a blanked
 * source: `T` in `const table: T = {`, `readonly table: T = {` or `(table: T = {`. Nothing when
 * the expression is not written after `: T =`.
 */
export function annotationBefore(code: string, start: number): string | undefined {
  const assignment = ASSIGNS.exec(code.slice(Math.max(0, start - 40), start));

  if (assignment === null) {
    return undefined;
  }

  const equals = start - assignment[0].length;
  let depth = 0;

  for (let i = equals - 1; i >= Math.max(0, equals - WINDOW); i -= 1) {
    const char = code.charAt(i);

    depth -= typeBrackets(char, code.charAt(i - 1));

    if (depth < 0 || (depth === 0 && (char === ';' || char === '='))) {
      return undefined;
    }

    if (depth === 0 && char === ':') {
      return code.slice(i + 1, equals).trim();
    }
  }

  return undefined;
}
