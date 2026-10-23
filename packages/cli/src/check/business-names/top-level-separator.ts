import { BRACKETS } from '../text/brackets';

/** Offset of the first `separator` met outside brackets, or -1: the `:` of `key: alias`, the `=` of a default. */
export function topLevelSeparator(text: string, separator: ':' | '='): number {
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);

    if (BRACKETS.openers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.closers.includes(char)) {
      depth -= 1;
    } else if (depth === 0 && char === separator && !isPartOfOperator(text, i)) {
      return i;
    }
  }

  return -1;
}

/** `=>`, `==`, `<=`: an `=` that is not alone. */
function isPartOfOperator(text: string, at: number): boolean {
  return text.charAt(at) === '=' && /[=<>!]/.test(text.charAt(at - 1) + text.charAt(at + 1));
}
