import { typeBrackets } from './type-brackets.js';

/** What ends a type written after `satisfies`, outside any bracket. */
const END = /^(?:[;,:?=)\]}]|\|\||&&|\n(?!\s*[|&]))/;

/**
 * The type written from `from` in a blanked source, trimmed: up to a `;`, a `,`, a `:`, a `?`, a
 * `=`, a `||` or a `&&` outside any bracket, the bracket closing around it, or the end of the line
 * when the next one does not go on with `|` or `&`. A union stays whole, so that it can be refused.
 */
export function typeAt(code: string, from: number): string {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    if (depth === 0 && END.test(code.slice(i, i + 256))) {
      return code.slice(from, i).trim();
    }

    depth += typeBrackets(code.charAt(i), code.charAt(i - 1));

    if (depth < 0) {
      return code.slice(from, i).trim();
    }
  }

  return code.slice(from).trim();
}
