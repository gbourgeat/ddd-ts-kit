const OPENERS = '([{';
const CLOSERS = ')]}';
const QUOTES = '\'"`';
/** Deep enough that no character of a string literal is ever read as code. */
const IN_STRING = 1000;

/**
 * How many brackets enclose each character of one line of code; a bracket counts as outside the
 * pair it opens or closes, and a string literal as far inside.
 */
export function nesting(text: string): number[] {
  const depths: number[] = [];
  let depth = 0;
  let quote = '';

  for (const [index, char] of text.split('').entries()) {
    if (quote !== '') {
      depths.push(depth + IN_STRING);
      quote = char === quote && text[index - 1] !== '\\' ? '' : quote;
    } else if (QUOTES.includes(char)) {
      depths.push(depth + IN_STRING);
      quote = char;
    } else {
      depth -= CLOSERS.includes(char) ? 1 : 0;
      depths.push(depth);
      depth += OPENERS.includes(char) ? 1 : 0;
    }
  }

  return depths;
}
