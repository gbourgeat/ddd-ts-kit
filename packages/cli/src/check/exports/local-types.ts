import { afterTypeParameters } from '../text/after-type-parameters.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { endAtDepthZero } from '../text/end-at-depth-zero.js';
import { matchingBracket } from '../text/matching-bracket.js';

/** An interface or a type alias declared at the top level of a file, exported or not. */
export interface LocalType {
  readonly name: string;
  readonly text: string;
  /** The names a union type alias joins directly: `Ok` and `Err` for `type Result = Ok | Err`. */
  readonly members: readonly string[];
}

const TYPE = /(?<![\w$.])(interface|type)\s+([A-Za-z_$][\w$]*)/g;
const OPENING = /^\s*(?:[={]|extends\b)/;

export function localTypes(code: string): LocalType[] {
  return [...code.matchAll(TYPE)].flatMap((match) => {
    const opening = afterTypeParameters(code, match.index + match[0].length);

    if (braceDepthAt(code, match.index) !== 0 || !OPENING.test(code.slice(opening, opening + 200))) {
      return [];
    }

    const isAlias = match[1] === 'type';
    const end = isAlias ? endAtDepthZero(code, opening, ';') : matchingBracket(code, code.indexOf('{', opening)) + 1;
    const aliased = code.slice(code.indexOf('=', opening) + 1, end);

    return [
      { name: match[2] ?? '', text: code.slice(match.index, end), members: isAlias ? unionMembers(aliased) : [] },
    ];
  });
}

/** `Ok` and `Err` for `Ok | Err`, type arguments aside: `Ok<T> | Err<E>` joins the same two names. */
function unionMembers(aliased: string): string[] {
  const parts = aliased.split('|').flatMap((part) => (part.trim() === '' ? [] : [part.trim()]));

  return parts.length < 2 ? [] : parts.flatMap((part) => /^([A-Za-z_$][\w$]*)\s*(?:<[\s\S]*>)?$/.exec(part)?.[1] ?? []);
}
