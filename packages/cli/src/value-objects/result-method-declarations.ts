import { matchingBracket } from '../check/text/matching-bracket.js';
import { closingAngle } from './closing-angle.js';
import type { Edit } from './edit.js';
import { firstTypeArgument } from './first-type-argument.js';

/** A method declared with a `Result<T, E>` return type, the edit that makes it return `T`, and where its body stands. */
export interface ResultMethodDeclaration {
  readonly name: string;
  readonly isStatic: boolean;
  readonly edit: Edit;
  /** From the brace opening the body of the method to the one closing it. */
  readonly body: Range;
}

export interface Range {
  readonly start: number;
  readonly end: number;
}

const METHOD_HEADER = /(?<=^|\n)[ \t]*(?:(?:public|protected|private)\s+)?(static\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
const RESULT_TYPE = /^\s*:\s*Result\s*</;

/**
 * The methods declared between two offsets of scanned code, one per line start, that return a
 * `Result`: `static create(raw: string): Result<Email, EmailError> {`.
 */
export function resultMethodDeclarations(code: string, source: string, within: Range): ResultMethodDeclaration[] {
  return [...code.matchAll(METHOD_HEADER)].flatMap((header) => {
    const close = matchingBracket(code, header.index + header[0].length - 1);
    const typed = header.index > within.start && close < within.end ? RESULT_TYPE.exec(code.slice(close + 1)) : null;

    if (typed === null) {
      return [];
    }

    const open = close + typed[0].length;
    const end = closingAngle(code, open) + 1;
    const value = source.slice(open + 1, firstTypeArgument(code, open)).trim();
    const start = close + 1 + typed[0].indexOf(':') + 1;
    const opening = code.indexOf('{', end);
    const body = { start: opening, end: opening === -1 ? end : matchingBracket(code, opening) };

    return [
      { name: header[2] ?? '', isStatic: header[1] !== undefined, edit: { start, end, text: ` ${value}` }, body },
    ];
  });
}
