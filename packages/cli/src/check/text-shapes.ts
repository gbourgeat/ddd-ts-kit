import type { SourceFile } from './types.js';

/** Shapes read on the blanked code of the scanner: calls, chains, statements, exported classes. */

const OPENERS = '([{';
const CLOSERS = ')]}';
const CHAINED_CALL = /^\s*\.\s*[\w$]+\s*(?:<[^<>()]*>)?\s*\(/;
const EXPORTED_CLASS = /(?<![\w$.])export\s+(?:default\s+)?class\s+([\w$]+)/;

/** Offset just after the parenthesis closing the call whose arguments start at `open`. */
export function callEnd(code: string, open: number): number {
  let depth = 1;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    if (code[i] === ')') depth -= 1;
    if (depth === 0) return i + 1;
  }
  return code.length;
}

/** Offset just after the last call chained on the one whose arguments start at `open`: `a(...).b(...).c(...)`. */
export function chainEnd(code: string, open: number): number {
  let end = callEnd(code, open);
  for (;;) {
    const next = CHAINED_CALL.exec(code.slice(end, end + 200));
    if (next === null) return end;
    end = callEnd(code, end + next[0].length);
  }
}

/** The first argument of the call whose arguments start at `open`. */
export function firstArgument(code: string, open: number): string {
  return code.slice(open, endAtDepthZero(code, open, ','));
}

/** Offset of the `;` ending the statement that holds `from`, or of the bracket closing the block around it. */
export function statementEnd(code: string, from: number): number {
  return endAtDepthZero(code, from, ';');
}

function endAtDepthZero(code: string, from: number, terminator: string): number {
  let depth = 0;
  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char)) depth -= 1;
    if (depth < 0 || (depth === 0 && char === terminator)) return i;
  }
  return code.length;
}

export function braceDepthAt(code: string, offset: number): number {
  const before = code.slice(0, offset);
  return before.split('{').length - before.split('}').length;
}

export interface NamedClass {
  readonly name: string;
  readonly line: number;
}

/** The first concrete class a file exports. */
export function exportedClass(file: SourceFile): NamedClass | undefined {
  const match = EXPORTED_CLASS.exec(file.scan.code);
  const name = match?.[1];
  return match === null || name === undefined ? undefined : { name, line: file.scan.lineAt(match.index) };
}

/** Matches `name` used as an identifier, not as a part of a longer one. */
export function identifier(name: string): RegExp {
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`);
}
