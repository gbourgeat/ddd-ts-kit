import type { NamedBinding } from './named-binding';

const PROPERTY =
  /^[ \t]*(?:(?:public|private|protected|static|readonly|declare|override|abstract)\s+)*([A-Za-z_$][\w$]*)\??\s*(?=:|;|=(?![=>]))/gm;

const DECLARES_A_SHAPE =
  /(?:(?<![\w$.])(?:class|interface)\s+[\w$]+[^{;]*|(?<![\w$.])type\s+[\w$]+(?:<[^=]*>)?\s*=\s*)$/;

/**
 * The properties a source declares in a class, an interface or a type alias of an object: a key
 * of an object literal follows the type it is written for, and is not one of them.
 */
export function propertyBindings(code: string): NamedBinding[] {
  return [...code.matchAll(PROPERTY)].flatMap((match) => {
    const brace = enclosingBrace(code, match.index);
    const head = code.slice(Math.max(0, brace - 300), brace);

    if (brace === -1 || !DECLARES_A_SHAPE.test(head)) {
      return [];
    }

    const name = match[1] ?? '';

    return [{ name, offset: match.index + match[0].lastIndexOf(name), kind: 'property' as const }];
  });
}

function enclosingBrace(code: string, from: number): number {
  let depth = 0;

  for (let i = from - 1; i >= 0; i -= 1) {
    const char = code.charAt(i);

    if (char === '}') {
      depth += 1;
    } else if (char === '{' && (depth -= 1) < 0) {
      return i;
    }
  }

  return -1;
}
