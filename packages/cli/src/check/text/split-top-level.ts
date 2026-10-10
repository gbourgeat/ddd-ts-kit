import { BRACKETS } from './brackets.js';
import type { ListPart } from './list-part.js';
import { splitAtCommas } from './split-at-commas.js';

/** Splits a list of expressions on the commas that are not nested in brackets. */
export function splitTopLevel(text: string): ListPart[] {
  return splitAtCommas(text, (char) => {
    if (BRACKETS.openers.includes(char)) return 1;

    return BRACKETS.closers.includes(char) ? -1 : 0;
  });
}
