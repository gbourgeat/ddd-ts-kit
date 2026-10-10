import { BRACKETS } from './brackets.js';
import { splitAtCommas } from './split-at-commas.js';

/** The parameters of a signature: split on the commas nested neither in brackets nor in type arguments, `this` left out. */
export function splitParameters(text: string): string[] {
  const parts = splitAtCommas(text, (char, previous) => {
    if (BRACKETS.openers.includes(char) || char === '<') return 1;

    const arrow = char === '>' && previous === '=';

    return BRACKETS.closers.includes(char) || (char === '>' && !arrow) ? -1 : 0;
  });

  return parts.map((part) => part.code).filter((part) => !part.startsWith('this:') && !part.startsWith('this '));
}
