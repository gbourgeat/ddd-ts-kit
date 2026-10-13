import { matchingBracket } from '../text/matching-bracket.js';

/**
 * The brace opening the body of a class whose heritage starts at `from`, past the object types
 * its type arguments may hold: `class Money extends ValueObject<{ readonly cents: number }> {`.
 */
export function classBodyBrace(code: string, from: number): number {
  let angles = 0;

  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (char === '{' && angles === 0) {
      return i;
    }

    if (char === '<' || (char === '>' && code.charAt(i - 1) !== '=')) {
      angles += char === '<' ? 1 : -1;
    } else if ('({['.includes(char)) {
      i = matchingBracket(code, i);
    }
  }

  return code.length - 1;
}
