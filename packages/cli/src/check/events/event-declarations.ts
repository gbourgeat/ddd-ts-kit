import type { SourceFile } from '../model/source-file.js';
import { callEnd } from '../text/call-end.js';
import { isTypeLiteral } from './is-type-literal.js';

const DECLARATION = /(?<![\w$.])defineIntegrationEvent\s*(?:<[^<>()]*>)?\s*\(/g;
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

/** The `defineIntegrationEvent({ ... })` calls found in a source. */
export function eventDeclarations(file: SourceFile): EventDeclaration[] {
  const { code } = file.scan;

  return [...code.matchAll(DECLARATION)].map((match) => {
    const argumentsStart = match.index + match[0].length;
    const end = callEnd(code, argumentsStart);
    const body = code.slice(match.index, end);

    return {
      start: match.index,
      end,
      type: typeOf(file, argumentsStart, end),
      version: VERSION_KEY.exec(body)?.[1] ?? '?',
      hasPayload: PAYLOAD_KEY.test(body),
    };
  });
}

function typeOf(file: SourceFile, argumentsStart: number, end: number): EventDeclaration['type'] {
  const { code, strings } = file.scan;

  const type = strings.find((literal) => {
    if (literal.start < argumentsStart || literal.start >= end || !isTypeLiteral(file, literal.start)) {
      return false;
    }

    // Directly in the options object: one brace deep, not inside a nested call.
    const before = code.slice(argumentsStart, literal.start);

    return count(before, '{') - count(before, '}') === 1 && count(before, '(') === count(before, ')');
  });

  return type === undefined ? undefined : { value: type.value, line: type.line };
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
