import type { Scan } from '../scan/scan.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { BRACKETS } from '../text/brackets.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { signatureAt } from './signature-at.js';

/** A function `readStructure` does not list: an arrow, a function expression, a function declared inside another. */
export interface InlineFunction {
  readonly label: string;
  readonly line: number;
  /** Lines holding code in the body: between the braces of a block, the whole of an expression. */
  readonly bodyLines: number;
}

const ARROW = /=>/g;
const FUNCTION = /(?<![\w$.])function\b\s*\*?\s*([A-Za-z_$][\w$]*)?\s*(?:<[^(]*>)?\s*\(/g;
const ASSIGNED = /([\w$]+)\s*(?::[^=;]*)?=\s*(?:async\s*)?(?:\([^()]*\)|[\w$]+)\s*(?::[^=;(){}]*)?\s*$/;
const GIVEN = /([\w$.]+)\s*\((?:[^()]*,)?\s*(?:async\s*)?(?:\([^()]*\)|[\w$]+)\s*$/;
const CONTINUES_BELOW = /^\s*[?:.|&+\-*/%<>=]/;
const CONTINUES_ABOVE = /(?:[?:|&+\-*/%<=]|=>)\s*$/;

/**
 * The arrows, function expressions and nested function declarations of a source whose body is
 * longer than `longerThan` lines: callbacks of `describe` and `it` and class property arrows
 * included. Methods and the functions declared at the top of the module are read by `readStructure`.
 */
export function inlineFunctions(scan: Scan, longerThan: number): InlineFunction[] {
  const { code } = scan;
  const lastLine = scan.lineAt(code.length);
  const mayBeLong = (at: number): boolean => lastLine - scan.lineAt(at) > longerThan;

  const arrows = [...code.matchAll(ARROW)]
    .filter((match) => mayBeLong(match.index))
    .map((match) => arrowAt(scan, match.index));

  const functions = [...code.matchAll(FUNCTION)]
    .filter((match) => mayBeLong(match.index))
    .flatMap((match) => functionAt(scan, match));

  return [...arrows, ...functions]
    .filter((found) => found.bodyLines > longerThan)
    .sort((left, right) => left.line - right.line);
}

function arrowAt(scan: Scan, arrow: number): InlineFunction {
  const { code } = scan;
  const start = arrow + 2 + (/^\s*/.exec(code.slice(arrow + 2, arrow + 400))?.[0].length ?? 0);

  const body =
    code.charAt(start) === '{'
      ? code.slice(start + 1, matchingBracket(code, start))
      : code.slice(start, expressionEnd(code, start));

  return {
    label: arrowLabel(code.slice(Math.max(0, arrow - 300), arrow)),
    line: scan.lineAt(arrow),
    bodyLines: codeLines(body),
  };
}

/** `charge` for `const charge = (..) =>` and a class property, the call for a callback, nothing better for the rest. */
function arrowLabel(before: string): string {
  const assigned = ASSIGNED.exec(before)?.[1];

  if (assigned !== undefined) {
    return assigned;
  }

  const callee = GIVEN.exec(before)?.[1];

  return callee === undefined ? 'An arrow function' : `The callback given to ${callee}`;
}

/** Where the expression an arrow answers with ends: a `;`, a `,` or a closing bracket of what holds it, or a line that nothing continues. */
function expressionEnd(code: string, from: number): number {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    depth += depthChange(code.charAt(i));

    if (depth < 0 || (depth === 0 && endsExpression(code, i))) {
      return i;
    }
  }

  return code.length;
}

function depthChange(char: string): number {
  if (BRACKETS.openers.includes(char)) {
    return 1;
  }

  return BRACKETS.closers.includes(char) ? -1 : 0;
}

function endsExpression(code: string, at: number): boolean {
  const char = code.charAt(at);

  return char === ';' || char === ',' || (char === '\n' && endsAtLineBreak(code, at));
}

function endsAtLineBreak(code: string, lineBreak: number): boolean {
  const above = code.slice(code.lastIndexOf('\n', lineBreak - 1) + 1, lineBreak);
  const below = code.slice(lineBreak + 1, lineBreak + 200);

  return above.trim() !== '' && !CONTINUES_ABOVE.test(above) && !CONTINUES_BELOW.test(below);
}

/** A function expression, or a declaration nested in a block: the named ones at the top of the module are not inline. */
function functionAt(scan: Scan, match: RegExpExecArray): InlineFunction[] {
  const name = match[1];

  const signature =
    name !== undefined && braceDepthAt(scan.code, match.index) === 0
      ? undefined
      : signatureAt(scan.code, match.index + match[0].length - 1);

  return signature === undefined
    ? []
    : [{ label: name ?? 'A function expression', line: scan.lineAt(match.index), bodyLines: signature.bodyLines }];
}

function codeLines(body: string): number {
  return body.split('\n').filter((line) => line.trim() !== '').length;
}
