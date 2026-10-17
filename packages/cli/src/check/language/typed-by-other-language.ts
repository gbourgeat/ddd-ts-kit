import type { StringRecord } from '../scan/string-record.js';
import { annotationBefore } from '../text/annotation-before.js';
import { BRACKETS } from '../text/brackets.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { typeAt } from '../text/type-at.js';
import { recordArguments } from './record-arguments.js';
import { typeRoot } from './type-root.js';

const SATISFIES = /^\s*satisfies\s+/;
const TABLE_SATISFIES = /^\s*(?:as\s+const\s+)?satisfies\s+/;
/** `name:`, `'name':`, `[key]:`: the key of an entry, before its value. */
const KEY = /^\s*(?:[\w$]+|'[^']*'|"[^"]*"|\[[^\]]*\])\s*:\s*$/;

/**
 * Whether the type of a string literal says it is a word of another language, one of `names`
 * (the names a file reads from another language): the literal is written `'x' satisfies T`, or it
 * is a key of an object typed `Record<T, ..>` or the whole value of an entry of one typed
 * `Record<.., T>`, by the annotation of its declaration or by `satisfies`. `T` is one reference.
 */
export function typedByOtherLanguage(code: string, literal: StringRecord, names: ReadonlyMap<string, string>): boolean {
  const satisfied = SATISFIES.exec(code.slice(literal.end, literal.end + 40));
  const type = satisfied === null ? tableSide(code, literal) : typeAt(code, literal.end + satisfied[0].length);
  const root = type === undefined ? undefined : typeRoot(type);

  return root !== undefined && names.has(root);
}

/** The key type of the table a literal is a key of, or its value type when the literal is the value of an entry. */
function tableSide(code: string, literal: StringRecord): string | undefined {
  const open = openingBrace(code, literal.start);

  if (open === undefined) {
    return undefined;
  }

  const side = sideOf(code, open, literal);
  const record = side === undefined ? undefined : recordArguments(tableType(code, open) ?? '');

  return side === 'key' ? record?.[0] : record?.[1];
}

/** Whether a literal written in the object opening at `open` is the key of an entry, or the whole value of one. */
function sideOf(code: string, open: number, literal: StringRecord): 'key' | 'value' | undefined {
  const entry = code.slice(entryStart(code, open, literal.start), literal.start);
  const next = code.slice(literal.end).trimStart().charAt(0);

  if (entry.trim() === '' && next === ':') {
    return 'key';
  }

  return KEY.test(entry) && (next === ',' || next === '}') ? 'value' : undefined;
}

/** The `{` of the object a literal is written in directly, if it is in an object and not in a call, an array or a nested object. */
function openingBrace(code: string, at: number): number | undefined {
  let depth = 0;

  for (let i = at - 1; i >= 0; i -= 1) {
    const char = code.charAt(i);

    if (BRACKETS.closers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.openers.includes(char) && (depth -= 1) < 0) {
      return char === '{' ? i : undefined;
    }
  }

  return undefined;
}

/** Where the entry holding `at` starts: after the last comma of the object before it. */
function entryStart(code: string, open: number, at: number): number {
  let depth = 0;
  let start = open + 1;

  for (let i = open + 1; i < at; i += 1) {
    const char = code.charAt(i);

    depth += BRACKETS.openers.includes(char) ? 1 : BRACKETS.closers.includes(char) ? -1 : 0;
    start = depth === 0 && char === ',' ? i + 1 : start;
  }

  return start;
}

/** The type of the object opening at `open`: the annotation of what it initializes, or what it satisfies. */
function tableType(code: string, open: number): string | undefined {
  const close = matchingBracket(code, open);
  const satisfied = TABLE_SATISFIES.exec(code.slice(close + 1, close + 80));

  return satisfied === null ? annotationBefore(code, open) : typeAt(code, close + 1 + satisfied[0].length);
}
