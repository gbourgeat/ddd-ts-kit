import { depthAt } from '../text/depth-at.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { typeBrackets } from '../text/type-brackets.js';

/** An interface or a type alias of a file: its name, the text it spans, and whether it is declared at the top of the file. */
export interface TypeDeclaration {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly topLevel: boolean;
}

const DECLARATION =
  /(?<![\w$.])(?:interface\s+([A-Za-z_$][\w$]*)|type\s+([A-Za-z_$][\w$]*)\s*(?:<[^;{}]*?>)?\s*=(?![=>]))/g;

/** A line that starts a new statement, which ends a type alias written without a semicolon. */
const STATEMENT =
  /^\s*(?:export|import|const|let|var|function|class|abstract|interface|type|enum|declare|async|@|\}|$)/;

/** The interfaces and type aliases of a blanked source, in source order. */
export function typeDeclarations(code: string): TypeDeclaration[] {
  return [...code.matchAll(DECLARATION)].map((match) => {
    const start = match.index;
    const end = match[1] === undefined ? aliasEnd(code, start + match[0].length) : interfaceEnd(code, start);

    return { name: match[1] ?? match[2] ?? '', start, end, topLevel: depthAt(code, 0, start) === 0 };
  });
}

function interfaceEnd(code: string, start: number): number {
  const body = code.indexOf('{', start);

  return body === -1 ? start : matchingBracket(code, body) + 1;
}

/** The `;` ending a type alias, the bracket closing the block around it, or the end of its last line. */
function aliasEnd(code: string, from: number): number {
  let depth = 0;

  for (let i = from; i < code.length; i += 1) {
    const char = code.charAt(i);

    depth += typeBrackets(char, code.charAt(i - 1));

    if (depth < 0 || (depth === 0 && (char === ';' || endsLine(code, i)))) {
      return i;
    }
  }

  return code.length;
}

/** A line break after which a statement starts, when what comes before it cannot go on. */
function endsLine(code: string, at: number): boolean {
  return (
    code.charAt(at) === '\n' &&
    !/[=|&<,(:?]\s*$/.test(code.slice(Math.max(0, at - 40), at)) &&
    STATEMENT.test(code.slice(at + 1, at + 80))
  );
}
