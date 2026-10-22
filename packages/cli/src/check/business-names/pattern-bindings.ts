import { matchingBracket } from '../text/matching-bracket';
import { splitTopLevel } from '../text/split-top-level';
import { identifierAt } from './identifier-at';
import type { NamedBinding } from './named-binding';
import { topLevelSeparator } from './top-level-separator';

/**
 * The names a destructuring pattern binds, the one opening at `open` (`{` or `[`): the alias of
 * `key: alias`, a shorthand key, a rest element, at any depth. Defaults are not bindings.
 */
export function patternBindings(code: string, open: number): NamedBinding[] {
  const close = matchingBracket(code, open);
  const isObject = code.charAt(open) === '{';

  return splitTopLevel(code.slice(open + 1, close)).flatMap((part) => {
    const start = open + 1 + part.start;
    const colon = isObject ? topLevelSeparator(part.code, ':') : -1;

    return elementBindings(code, colon === -1 ? start : valueStart(code, start + colon + 1));
  });
}

/** One element of a pattern, from its first character: a nested pattern, a rest, or a name with its default. */
function elementBindings(code: string, start: number): NamedBinding[] {
  const at = code.startsWith('...', start) ? start + 3 : start;
  const opener = code.charAt(at);

  if (opener === '{' || opener === '[') {
    return patternBindings(code, at);
  }

  const name = identifierAt(code, at);

  return name === '' ? [] : [{ name, offset: at, kind: 'destructured binding' }];
}

function valueStart(code: string, from: number): number {
  return from + (/^\s*/.exec(code.slice(from, from + 200))?.[0].length ?? 0);
}
