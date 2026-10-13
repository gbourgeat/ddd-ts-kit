import type { Scan } from '../scan/scan.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { splitTopLevel } from '../text/split-top-level.js';

/** One type of a file as a stored shape reads it: its members, and the named types they use. */
export interface DeclaredShape {
  /** Each member without its whitespace, literals kept, sorted. */
  readonly members: readonly string[];
  readonly references: readonly string[];
}

/** Words of a type that name no declaration: keywords, primitives, and the generic types of the language. */
const NOT_DECLARED = new Set([
  ...['readonly', 'extends', 'keyof', 'typeof', 'infer', 'unique', 'symbol', 'in', 'is', 'as', 'any', 'void'],
  ...['string', 'number', 'boolean', 'bigint', 'null', 'undefined', 'unknown', 'never', 'object', 'true', 'false'],
  ...['Array', 'ReadonlyArray', 'Readonly', 'Record', 'Partial', 'Required', 'Pick', 'Omit', 'NonNullable', 'Date'],
]);

/** A word of the type that is not a member name (`name:` or `name?:`) nor a method (`name(`). */
const TYPE_WORD = /(?<![\w$.])[A-Za-z_$][\w$]*(?![\w$])(?!\s*\??\s*[:(])/g;

/**
 * The shape the file declares under `typeName`: an interface, an object type, an enum, or any
 * other alias up to its semicolon. `undefined` when the file declares no such type.
 */
export function declaredShape(scan: Scan, typeName: string): DeclaredShape | undefined {
  const declared = new RegExp(`(?<![\\w$.])(?<!import\\s+)(interface|type|enum)\\s+${typeName}(?![\\w$])`).exec(
    scan.code,
  );

  if (declared === null) {
    return undefined;
  }

  const from = declared.index + declared[0].length;
  const [start, end] = bodyOf(scan.code, from);

  return {
    members: membersOf(scan, start, end).sort(),
    references: declared[1] === 'enum' ? [] : typeWords(scan.code.slice(from, end), typeParameters(scan.code, from)),
  };
}

/** The named types a piece of a type uses, its own type parameters aside; the members of an enum are values, never types. */
function typeWords(text: string, parameters: ReadonlySet<string>): string[] {
  return [...text.matchAll(TYPE_WORD)]
    .map(([word]) => word)
    .filter((word) => !NOT_DECLARED.has(word) && !parameters.has(word));
}

/** The names `<T, U extends X = Y>` declares right after the name of the type. */
function typeParameters(code: string, from: number): ReadonlySet<string> {
  const open = /^\s*</.exec(code.slice(from));

  if (open === null) {
    return new Set();
  }

  const start = from + open[0].length;
  const list = code.slice(start, closingAngle(code, start));

  return new Set(splitTopLevel(list).flatMap(({ code: part }) => /^[A-Za-z_$][\w$]*/.exec(part)?.[0] ?? []));
}

/** Offset of the `>` closing the list of type parameters that starts at `from`. */
function closingAngle(code: string, from: number): number {
  let depth = 0;

  for (let at = from; at < code.length; at += 1) {
    const char = code.charAt(at);

    depth += char === '<' ? 1 : 0;

    if (char === '>' && (depth -= 1) < 0) {
      return at;
    }
  }

  return code.length;
}

/** Between the braces of an interface, an object type or an enum; after `=` up to `;` for any other alias. */
function bodyOf(code: string, from: number): [number, number] {
  const header = /^[^{=;]*(?:=\s*)?/.exec(code.slice(from))?.[0] ?? '';
  const at = from + header.length;

  if (code.charAt(at) === '{') {
    return [at + 1, matchingBracket(code, at)];
  }

  let depth = 0;

  for (let end = at; end < code.length; end += 1) {
    depth += depthChange(code.charAt(end));

    if (depth === 0 && code.charAt(end) === ';') {
      return [at, end];
    }
  }

  return [at, code.length];
}

/** The members between two offsets, split at the separators of depth zero, each without its whitespace, literals kept. */
function membersOf(scan: Scan, from: number, to: number): string[] {
  const members: string[] = [];
  let current = '';
  let depth = 0;

  for (let at = from; at < to; at += 1) {
    const literal = scan.strings.find((record) => record.start === at);
    const char = scan.code.charAt(at);

    if (literal !== undefined) {
      current += JSON.stringify(literal.value);
      at = literal.end - 1;
    } else if (depth === 0 && ';,\n'.includes(char)) {
      members.push(current);
      current = '';
    } else {
      depth += depthChange(char);
      current += /\s/.test(char) ? '' : char;
    }
  }

  return [...members, current].filter((member) => member !== '');
}

function depthChange(char: string): number {
  if ('([{'.includes(char)) {
    return 1;
  }

  return ')]}'.includes(char) ? -1 : 0;
}
