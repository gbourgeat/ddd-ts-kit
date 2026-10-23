import { matchingBracket } from '../text/matching-bracket';
import { splitTopLevel } from '../text/split-top-level';
import { expressionRole } from './entry-role';

/** `name(..) {`, `get name() {`, `async [key](..) {`: a method of the literal. */
const METHOD = /^(?:async\s+)?(?:get\s+|set\s+)?\*?\s*(?:[\w$]+|'[^']*'|"[^"]*"|\[[^\]]*\])\s*(?:<[^()]*>)?\s*\(/;

/** `name:`, `'name':`, `[key]:`: the key of a property, before its value. */
const KEY = /^(?:[\w$]+|'[^']*'|"[^"]*"|\[[^\]]*\])\s*:/;

/**
 * Whether the object literal opening at `open` is a value of the model written as a record: it
 * holds data (an entry that is not a function), nothing a call or `new` of the model built, and
 * no spread. A record of value objects the function builds (`{ first: Money.of(1), rest }`) is an
 * operation of the model; a spread (`{ ...state, status }`) derives a record that exists; an
 * object of functions only is behaviour, a specification or a strategy. Names are read in `module`.
 */
export function standsForAValue(code: string, open: number, module: string): boolean {
  const roles = splitTopLevel(code.slice(open + 1, matchingBracket(code, open))).map(({ code: entry }) => {
    if (entry.startsWith('...')) {
      return 'spread';
    }

    if (METHOD.test(entry)) {
      return 'behaviour';
    }

    const key = KEY.exec(entry);

    return expressionRole(key === null ? entry : entry.slice(key[0].length), module);
  });

  return roles.includes('data') && !roles.includes('built') && !roles.includes('spread');
}
