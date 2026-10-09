import type { SourceFile } from './types.js';

/** `defineIntegrationEvent({ ... })` calls found in a source, shared by the events/* rules. */

const DECLARATION = /(?<![\w$.])defineIntegrationEvent\s*(?:<[^<>()]*>)?\s*\(/g;
const TYPE_KEY = /(?<![\w$.])type\s*\??\s*:\s*$/;
const PAYLOAD_KEY = /(?<![\w$.])payload\s*[:,}]/;
const VERSION_KEY = /(?<![\w$.])version\s*:\s*(\d+)/;

export interface EventDeclaration {
  readonly start: number;
  readonly end: number;
  /** The `type` given to the declaration itself, not a `type` of its payload schema. */
  readonly type: { readonly value: string; readonly line: number } | undefined;
  readonly version: string;
  readonly hasPayload: boolean;
}

export function isTypeLiteral(file: SourceFile, start: number): boolean {
  return TYPE_KEY.test(file.scan.code.slice(Math.max(0, start - 40), start));
}

export function eventDeclarations(file: SourceFile): EventDeclaration[] {
  const { code, strings } = file.scan;
  return [...code.matchAll(DECLARATION)].map((match) => {
    const start = match.index;
    const argumentsStart = start + match[0].length;
    const end = closingOffset(code, argumentsStart);
    const body = code.slice(start, end);
    const type = strings.find((literal) => {
      if (literal.start <= start || literal.start >= end || !isTypeLiteral(file, literal.start)) return false;
      // Directly in the options object: one brace deep, not inside a nested call.
      const before = code.slice(argumentsStart, literal.start);
      return count(before, '{') - count(before, '}') === 1 && count(before, '(') === count(before, ')');
    });
    return {
      start,
      end,
      type: type === undefined ? undefined : { value: type.value, line: type.line },
      version: VERSION_KEY.exec(body)?.[1] ?? '?',
      hasPayload: PAYLOAD_KEY.test(body),
    };
  });
}

export function inDeclaration(declarations: readonly EventDeclaration[], offset: number): boolean {
  return declarations.some((declaration) => offset > declaration.start && offset < declaration.end);
}

/** Offset just after the parenthesis closing the call whose arguments start at `open`. */
function closingOffset(code: string, open: number): number {
  let depth = 1;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    if (code[i] === ')') depth -= 1;
    if (depth === 0) return i + 1;
  }
  return code.length;
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
