import { statementEnd } from '../text/statement-end';
import { closingParenthesis } from './closing-parenthesis';
import { identifierAt } from './identifier-at';
import type { NamedBinding } from './named-binding';
import { patternBindings } from './pattern-bindings';
import { topLevelSeparator } from './top-level-separator';

const DECLARATION = /(?<![\w$.])(?:const|let|var)\s+(?=[A-Za-z_$[{])/g;
const OPENS_A_LOOP = /(?<![\w$.])for\s*(?:await\s*)?\(\s*$/;
const WALKS = /^\s+(?:of|in)\s+/;

/** The variables a source declares with `const`, `let` or `var`, loop variables and destructured names included. */
export function declaredBindings(code: string): NamedBinding[] {
  return [...code.matchAll(DECLARATION)].flatMap((match) => {
    const at = match.index + match[0].length;
    const opener = code.charAt(at);

    if (opener === '{' || opener === '[') {
      return patternBindings(code, at);
    }

    const name = identifierAt(code, at);
    const after = at + name.length;

    if (OPENS_A_LOOP.test(code.slice(Math.max(0, match.index - 20), match.index))) {
      return [{ name, offset: at, kind: 'loop variable', source: walkedCollection(code, after) }];
    }

    return [{ name, offset: at, kind: 'variable', source: initializer(code, after) }];
  });
}

/** `due` in `for (const target of due)`. */
function walkedCollection(code: string, from: number): string {
  const rest = code.slice(from, from + 400);
  const walks = WALKS.exec(rest);

  if (walks === null) {
    return '';
  }

  const start = walks[0].length;

  return rest.slice(start, closingParenthesis(rest, start)).trim();
}

/** What follows the `=` of a declaration, its type annotation skipped. */
function initializer(code: string, from: number): string {
  const declared = code.slice(from, statementEnd(code, from));
  const equals = topLevelSeparator(declared, '=');

  return equals === -1 ? '' : declared.slice(equals + 1).trim();
}
