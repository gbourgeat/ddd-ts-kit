import { matchingBracket } from '../text/matching-bracket';
import { openingBracket } from './opening-bracket';

/** A parameter list, by the offsets of its parentheses, or the one parameter of `name =>`. */
export type ParameterList = { readonly open: number; readonly close: number } | { readonly single: number };

const FUNCTION = /(?<![\w$.])function\b\s*\*?\s*(?:[A-Za-z_$][\w$]*)?\s*(?:<[^(]*>)?\s*\(/g;

const MEMBER =
  /^[ \t]*(?:(?:public|private|protected|static|abstract|override|async|readonly|declare|get|set)\s+)*\*?\s*([A-Za-z_$][\w$]*)\??\s*(?:<[^()\n]*>)?\s*\(/gm;

const NOT_A_MEMBER = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'await',
  'typeof',
  'function',
  'new',
  'throw',
  'super',
  'this',
  'void',
  'delete',
  'yield',
  'with',
  'do',
  'else',
  'case',
]);

const SIGNATURE_GOES_ON = /^\s*[:{]/;
const ARROW = /=>/g;
const IDENTIFIER_CHAR = /[\w$]/;

/**
 * The parameter lists of a blanked source: functions, methods and signatures of classes,
 * interfaces and object literals (a body or a return type follows their parentheses, which tells
 * them from a call), arrows, and the function types of annotations.
 */
export function parameterLists(code: string): ParameterList[] {
  const functions = [...code.matchAll(FUNCTION)].map((match) => enclosed(code, match.index + match[0].length - 1));

  const members = [...code.matchAll(MEMBER)]
    .filter((match) => !NOT_A_MEMBER.has(match[1] ?? ''))
    .map((match) => enclosed(code, match.index + match[0].length - 1))
    .filter(({ close }) => SIGNATURE_GOES_ON.test(code.slice(close + 1, close + 40)));

  const arrows = [...code.matchAll(ARROW)].flatMap((match) => arrowParameters(code, match.index));
  const seen = new Set<number>();

  return [...functions, ...members, ...arrows].filter((list) => {
    const key = 'open' in list ? list.open : list.single;
    const fresh = !seen.has(key);

    seen.add(key);

    return fresh;
  });
}

function enclosed(code: string, open: number): { open: number; close: number } {
  return { open, close: matchingBracket(code, open) };
}

/** The parameters of the arrow at `arrow`: `(..) =>`, `(..): Type =>` or `name =>`. */
function arrowParameters(code: string, arrow: number): ParameterList[] {
  const last = previousCode(code, arrow - 1);

  if (code.charAt(last) === ')') {
    return listClosingAt(code, last);
  }

  const returnType = returnTypeColon(code, last);

  if (returnType !== undefined) {
    return listClosingAt(code, previousCode(code, returnType - 1));
  }

  if (!IDENTIFIER_CHAR.test(code.charAt(last))) {
    return [];
  }

  let start = last;

  while (start > 0 && IDENTIFIER_CHAR.test(code.charAt(start - 1))) {
    start -= 1;
  }

  return code.charAt(previousCode(code, start - 1)) === '.' ? [] : [{ single: start }];
}

/** The list whose `)` is at `close`, which both callers have checked is one. */
function listClosingAt(code: string, close: number): ParameterList[] {
  const open = openingBracket(code, close);

  return open === -1 ? [] : [{ open, close }];
}

/** The `:` of a return type written between the parentheses of an arrow and its `=>`. */
function returnTypeColon(code: string, from: number): number | undefined {
  let depth = 0;

  for (let i = from; i >= Math.max(0, from - 300); i -= 1) {
    const char = code.charAt(i);

    depth += typeDepthChange(code, i);

    if (depth < 0 || (depth === 0 && '=;,'.includes(char))) {
      return undefined;
    }

    if (depth === 0 && char === ':') {
      return code.charAt(previousCode(code, i - 1)) === ')' ? i : undefined;
    }
  }

  return undefined;
}

/** Read backwards: a closing bracket of a type opens a level, an opening one closes it; the `>` of `=>` is no bracket. */
function typeDepthChange(code: string, at: number): number {
  const char = code.charAt(at);

  if (')]}>'.includes(char)) {
    return char === '>' && code.charAt(at - 1) === '=' ? 0 : 1;
  }

  return '([{<'.includes(char) ? -1 : 0;
}

function previousCode(code: string, from: number): number {
  let at = from;

  while (at > 0 && /\s/.test(code.charAt(at))) {
    at -= 1;
  }

  return at;
}
