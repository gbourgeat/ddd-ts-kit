/**
 * A deliberately small lexer: enough to tell code from comments, strings, templates
 * and regular expressions, so imports can be found without a compiler. It does not
 * parse TypeScript; see the README for what it cannot see.
 */

type ImportKind = 'import' | 'export' | 'side-effect' | 'dynamic' | 'require';

interface ImportRecord {
  readonly kind: ImportKind;
  readonly specifier: string;
  readonly line: number;
  readonly typeOnly: boolean;
  /** Local names bound by the statement (default, named, namespace). */
  readonly names: readonly string[];
}

interface CommentRecord {
  readonly line: number;
  readonly text: string;
  /** False for a comment that shares its line with code. */
  readonly ownLine: boolean;
  /** Offset just after the comment. */
  readonly end: number;
}

interface BlockCommentRecord {
  /** Line of the opening delimiter. */
  readonly line: number;
  readonly endLine: number;
  /** Content between the delimiters, untouched. */
  readonly text: string;
  readonly jsdoc: boolean;
  /** Offset just after the closing delimiter. */
  readonly end: number;
}

interface StringRecord {
  readonly start: number;
  readonly end: number;
  readonly value: string;
  readonly line: number;
}

export interface Scan {
  /** Source with comments and literal contents blanked; offsets and lines are preserved. */
  readonly code: string;
  readonly strings: readonly StringRecord[];
  readonly comments: readonly CommentRecord[];
  readonly blockComments: readonly BlockCommentRecord[];
  readonly imports: readonly ImportRecord[];
  lineAt(offset: number): number;
}

export function scan(source: string): Scan {
  const lexer = new Lexer(source);
  lexer.run();
  const lineAt = (offset: number): number => lexer.lineAt(offset);
  return {
    code: lexer.code,
    strings: lexer.strings,
    comments: lexer.comments,
    blockComments: lexer.blockComments,
    imports: findImports(lexer.code, lexer.strings, lineAt),
    lineAt,
  };
}

const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = /(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|void|throw|new|delete|await|yield)$/;

/** Walks the source once, copying code and blanking what is not code. */
class Lexer {
  code = '';
  readonly strings: StringRecord[] = [];
  readonly comments: CommentRecord[] = [];
  readonly blockComments: BlockCommentRecord[] = [];
  readonly #lineStarts: number[] = [0];
  // Depth of `{` inside each open `${ ... }`, so the matching `}` returns to the template.
  readonly #templateDepths: number[] = [];
  #at = 0;

  constructor(private readonly source: string) {
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '\n') this.#lineStarts.push(i + 1);
    }
  }

  run(): void {
    while (this.#at < this.source.length) this.#step();
  }

  lineAt(offset: number): number {
    let low = 0;
    let high = this.#lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((this.#lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  }

  #step(): void {
    const char = this.source.charAt(this.#at);
    if (char === '/') this.#readFromSlash();
    else if (char === "'" || char === '"') this.#readQuoted(char);
    else if (char === '`') this.#readTemplateText(true);
    else if ((char === '{' || char === '}') && this.#templateDepths.length > 0) this.#readBraceInTemplate(char);
    else this.#copy(char);
  }

  /** A slash opens a comment or a regular expression, or divides. */
  #readFromSlash(): void {
    const next = this.source.charAt(this.#at + 1);
    if (next === '/') this.#readLineComment();
    else if (next === '*') this.#readBlockComment();
    else if (this.#regexMayStart()) this.#readRegex();
    else this.#copy('/');
  }

  #copy(char: string): void {
    this.code += char;
    this.#at += 1;
  }

  #readLineComment(): void {
    const start = this.#at;
    const end = this.source.indexOf('\n', start);
    const stop = end === -1 ? this.source.length : end;
    const lineStart = this.#lineStarts[this.lineAt(start) - 1] ?? 0;
    this.comments.push({
      line: this.lineAt(start),
      text: this.source.slice(start + 2, stop).trim(),
      ownLine: this.source.slice(lineStart, start).trim().length === 0,
      end: stop,
    });
    this.#blankUntil(stop);
  }

  #readBlockComment(): void {
    const start = this.#at;
    const end = this.source.indexOf('*/', start + 2);
    const stop = end === -1 ? this.source.length : end + 2;
    this.blockComments.push({
      line: this.lineAt(start),
      endLine: this.lineAt(Math.max(start, stop - 1)),
      text: this.source.slice(start + 2, end === -1 ? this.source.length : end),
      jsdoc: this.source[start + 2] === '*' && this.source[start + 3] !== '/',
      end: stop,
    });
    this.#blankUntil(stop);
  }

  #blankUntil(stop: number): void {
    this.code += blank(this.source.slice(this.#at, stop));
    this.#at = stop;
  }

  #readQuoted(quote: string): void {
    const start = this.#at;
    this.#at += 1;
    const value = this.#readUntil((char) => char === quote || char === '\n');
    const closed = this.source[this.#at] === quote;
    this.code += quote + blank(this.source.slice(start + 1, this.#at)) + (closed ? quote : '');
    if (closed) this.#at += 1;
    this.strings.push({ start, end: this.#at, value, line: this.lineAt(start) });
  }

  /** Advances to the first character that stops the literal and answers what was read, escapes resolved. */
  #readUntil(stops: (char: string, next: string) => boolean): string {
    let value = '';
    while (this.#at < this.source.length && !stops(this.source.charAt(this.#at), this.source.charAt(this.#at + 1))) {
      const escaped = this.source[this.#at] === '\\';
      value += this.source.charAt(escaped ? this.#at + 1 : this.#at);
      this.#at += escaped ? 2 : 1;
    }
    return value;
  }

  /** Reads template text up to the closing backtick or the next `${`. */
  #readTemplateText(opening: boolean): void {
    const start = this.#at;
    if (opening) this.#at += 1;
    const value = this.#readUntil((char, next) => char === '`' || (char === '$' && next === '{'));
    const interpolates = this.source[this.#at] === '$';
    const closed = this.source[this.#at] === '`';
    this.code += (opening ? '`' : '') + blank(this.source.slice(opening ? start + 1 : start, this.#at)) + (interpolates ? '${' : closed ? '`' : '');
    this.#at += interpolates ? 2 : closed ? 1 : 0;
    if (interpolates) this.#templateDepths.push(0);
    // Only a template without interpolation is a usable module specifier.
    else if (opening) this.strings.push({ start, end: this.#at, value, line: this.lineAt(start) });
  }

  #readBraceInTemplate(char: string): void {
    const depth = this.#templateDepths.at(-1) ?? 0;
    this.#copy(char);
    if (char === '{') {
      this.#templateDepths[this.#templateDepths.length - 1] = depth + 1;
    } else if (depth > 0) {
      this.#templateDepths[this.#templateDepths.length - 1] = depth - 1;
    } else {
      this.#templateDepths.pop();
      this.#readTemplateText(false);
    }
  }

  #regexMayStart(): boolean {
    const trimmed = this.code.trimEnd();
    if (trimmed.length === 0) return true;
    return REGEX_PRECEDERS.has(trimmed.charAt(trimmed.length - 1)) || REGEX_KEYWORDS.test(trimmed.slice(-12));
  }

  #readRegex(): void {
    const start = this.#at;
    this.#at += 1;
    let inClass = false;
    while (this.#at < this.source.length && this.source[this.#at] !== '\n') {
      const current = this.source[this.#at];
      if (current === '/' && !inClass) break;
      if (current === '[') inClass = true;
      if (current === ']') inClass = false;
      this.#at += current === '\\' ? 2 : 1;
    }
    const closed = this.source[this.#at] === '/';
    this.code += '/' + blank(this.source.slice(start + 1, this.#at)) + (closed ? '/' : '');
    if (closed) this.#at += 1;
  }
}

const FROM_CLAUSE = /(?<![\w$.])(import|export)\b(\s+type\b)?([\w\s{},*$]*?)\bfrom\s*$/;
const SIDE_EFFECT = /(?<![\w$.])import\s*$/;
const DYNAMIC = /(?<![\w$.])import\s*\(\s*$/;
const REQUIRE = /(?<![\w$.])require\s*\(\s*$/;
const SPECIFIER_HINT = /(?:from|import|require)\s*\(?\s*$/;
/** Longest import clause looked at before a specifier; generous for long named lists. */
const WINDOW = 4000;

function findImports(code: string, strings: readonly StringRecord[], lineAt: (offset: number) => number): ImportRecord[] {
  return strings.flatMap((literal) => {
    // Cheap filter first: most string literals are not module specifiers.
    if (!SPECIFIER_HINT.test(code.slice(Math.max(0, literal.start - 24), literal.start))) return [];
    const windowStart = Math.max(0, literal.start - WINDOW);
    const before = code.slice(windowStart, literal.start);
    const found = statementWithClause(before) ?? statementWithoutClause(before);
    return found === undefined ? [] : [{ ...found.record, specifier: literal.value, line: lineAt(windowStart + found.offset) }];
  });
}

interface FoundStatement {
  readonly record: Omit<ImportRecord, 'specifier' | 'line'>;
  /** Offset of the statement keyword in the text looked at. */
  readonly offset: number;
}

function statementWithClause(before: string): FoundStatement | undefined {
  const from = lastMatch(FROM_CLAUSE, before);
  if (from === undefined) return undefined;
  const kind = from.groups[1] === 'export' ? 'export' : 'import';
  return {
    record: { kind, typeOnly: from.groups[2] !== undefined, names: kind === 'import' ? clauseNames(from.groups[3] ?? '') : [] },
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
    if (match !== null) return { record: { kind, typeOnly: false, names: [] }, offset: match.index };
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
  const KEYWORD_LENGTH = 'import'.length;
  let groups = pattern.exec(text);
  if (groups === null) return undefined;
  let index = groups.index;
  for (;;) {
    const from = index + KEYWORD_LENGTH;
    const later = pattern.exec(text.slice(from));
    if (later === null) return { groups, index };
    groups = later;
    index = from + later.index;
  }
}

function clauseNames(clause: string): string[] {
  const braces = /\{([^}]*)\}/.exec(clause)?.[1];
  return [...defaultAndNamespaceNames(clause.replace(/\{[^}]*\}/, ' ')), ...namedBindings(braces ?? '')];
}

function defaultAndNamespaceNames(outsideBraces: string): string[] {
  return outsideBraces
    .split(',')
    .map((part) => /\*\s*as\s+([\w$]+)/.exec(part)?.[1] ?? part.trim())
    .filter((word) => /^[\w$]+$/.test(word) && word !== 'type');
}

function namedBindings(insideBraces: string): string[] {
  return insideBraces
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .map((cleaned) => /\bas\s+([\w$]+)$/.exec(cleaned)?.[1] ?? cleaned)
    .filter((local) => /^[\w$]+$/.test(local));
}

function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}
