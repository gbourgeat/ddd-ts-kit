import { BRACKETS } from '../text/brackets';

/** Where the value of `export const name: Type = value` starts: after the first `=` outside brackets that is not `=>`. */
export function initializerOf(text: string): number | undefined {
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);

    if (depth === 0 && char === '=' && !'=>'.includes(text.charAt(i + 1)) && !'=!<>'.includes(text.charAt(i - 1))) {
      return i + 1 + (/^\s*/.exec(text.slice(i + 1))?.[0].length ?? 0);
    }

    depth += BRACKETS.openers.includes(char) ? 1 : 0;
    depth -= BRACKETS.closers.includes(char) ? 1 : 0;
  }

  return undefined;
}
