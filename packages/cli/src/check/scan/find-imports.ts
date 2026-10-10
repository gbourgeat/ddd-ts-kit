import { clauseNames } from './clause-names.js';
import type { ImportKind, ImportRecord } from './import-record.js';
import type { StringRecord } from './string-record.js';

const FROM_CLAUSE = /(?<![\w$.])(import|export)\b(\s+type\b)?([\w\s{},*$]*?)\bfrom\s*$/;
const SIDE_EFFECT = /(?<![\w$.])import\s*$/;
const DYNAMIC = /(?<![\w$.])import\s*\(\s*$/;
const REQUIRE = /(?<![\w$.])require\s*\(\s*$/;
const SPECIFIER_HINT = /(?:from|import|require)\s*\(?\s*$/;
/** Longest import clause looked at before a specifier; generous for long named lists. */
const WINDOW = 4000;
const KEYWORD_LENGTH = 'import'.length;

interface FoundStatement {
  readonly record: Omit<ImportRecord, 'specifier' | 'line'>;
  /** Offset of the statement keyword in the text looked at. */
  readonly offset: number;
}

/** The import and export statements of a blanked source: one record per string literal that is a module specifier. */
export function findImports(
  code: string,
  strings: readonly StringRecord[],
  lineAt: (offset: number) => number,
): ImportRecord[] {
  return strings.flatMap((literal) => {
    // Cheap filter first: most string literals are not module specifiers.
    if (!SPECIFIER_HINT.test(code.slice(Math.max(0, literal.start - 24), literal.start))) {
      return [];
    }

    const windowStart = Math.max(0, literal.start - WINDOW);
    const before = code.slice(windowStart, literal.start);
    const found = statementWithClause(before) ?? statementWithoutClause(before);

    return found === undefined
      ? []
      : [{ ...found.record, specifier: literal.value, line: lineAt(windowStart + found.offset) }];
  });
}

function statementWithClause(before: string): FoundStatement | undefined {
  const from = lastMatch(FROM_CLAUSE, before);

  if (from === undefined) {
    return undefined;
  }

  const kind = from.groups[1] === 'export' ? 'export' : 'import';
  const typeOnly = from.groups[2] !== undefined;
  const bound = kind === 'import' ? clauseNames(from.groups[3] ?? '') : { names: [], typeNames: [] };

  return {
    record: { kind, typeOnly, names: bound.names, typeNames: typeOnly ? bound.names : bound.typeNames },
    offset: from.index,
  };
}

const WITHOUT_CLAUSE: readonly (readonly [RegExp, ImportKind])[] = [
  [SIDE_EFFECT, 'side-effect'],
  [DYNAMIC, 'dynamic'],
  [REQUIRE, 'require'],
];

function statementWithoutClause(before: string): FoundStatement | undefined {
  for (const [pattern, kind] of WITHOUT_CLAUSE) {
    const match = pattern.exec(before);

    if (match !== null) {
      return { record: { kind, typeOnly: false, names: [], typeNames: [] }, offset: match.index };
    }
  }

  return undefined;
}

/**
 * The clause pattern is anchored at the end, so the regex engine returns the earliest
 * `import` that reaches `from` through clause characters only: that is the statement
 * owning the specifier, because `=`, `(` or a quote of a previous statement break the run.
 * A previous statement made only of clause characters is cut off at its own keyword.
 */
function lastMatch(pattern: RegExp, text: string): { groups: RegExpExecArray; index: number } | undefined {
  let groups = pattern.exec(text);

  if (groups === null) {
    return undefined;
  }

  let index = groups.index;

  for (;;) {
    const from = index + KEYWORD_LENGTH;
    const later = pattern.exec(text.slice(from));

    if (later === null) {
      return { groups, index };
    }

    groups = later;
    index = from + later.index;
  }
}
