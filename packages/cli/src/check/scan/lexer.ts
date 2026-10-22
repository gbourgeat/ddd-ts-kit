import { blank } from './blank';
import type { BlockCommentRecord } from './block-comment-record';
import type { CommentRecord } from './comment-record';
import type { StringRecord } from './string-record';

const REGEX_PRECEDERS = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
]);

const REGEX_KEYWORDS = /(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|void|throw|new|delete|await|yield)$/;

/**
 * A deliberately small lexer: it walks the source once, copying code and blanking what is not
 * code (comments, strings, templates, regular expressions). It does not parse TypeScript.
 */
export class Lexer {
  code = '';
  readonly strings: StringRecord[] = [];
  readonly comments: CommentRecord[] = [];
  readonly blockComments: BlockCommentRecord[] = [];
  private readonly lineStarts: number[] = [0];
  /** Depth of `{` inside each open `${ ... }`, so the matching `}` returns to the template. */
  private readonly templateDepths: number[] = [];
  private at = 0;

  constructor(private readonly source: string) {
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '\n') {
        this.lineStarts.push(i + 1);
      }
    }
  }

  run(): void {
    while (this.at < this.source.length) {
      this.step();
    }
  }

  lineAt(offset: number): number {
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low < high) {
      const middle = (low + high + 1) >> 1;

      if ((this.lineStarts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low + 1;
  }

  private step(): void {
    const char = this.source.charAt(this.at);

    if (char === '/') {
      this.readFromSlash();
    } else if (char === "'" || char === '"') {
      this.readQuoted(char);
    } else if (char === '`') {
      this.readTemplateText(true);
    } else if ((char === '{' || char === '}') && this.templateDepths.length > 0) {
      this.readBraceInTemplate(char);
    } else {
      this.copy(char);
    }
  }

  /** A slash opens a comment or a regular expression, or divides. */
  private readFromSlash(): void {
    const next = this.source.charAt(this.at + 1);

    if (next === '/') {
      this.readLineComment();
    } else if (next === '*') {
      this.readBlockComment();
    } else if (this.regexMayStart()) {
      this.readRegex();
    } else {
      this.copy('/');
    }
  }

  private copy(char: string): void {
    this.code += char;
    this.at += 1;
  }

  private readLineComment(): void {
    const start = this.at;
    const end = this.source.indexOf('\n', start);
    const stop = end === -1 ? this.source.length : end;
    const lineStart = this.lineStarts[this.lineAt(start) - 1] ?? 0;

    this.comments.push({
      line: this.lineAt(start),
      text: this.source.slice(start + 2, stop).trim(),
      ownLine: this.source.slice(lineStart, start).trim().length === 0,
      end: stop,
    });

    this.blankUntil(stop);
  }

  private readBlockComment(): void {
    const start = this.at;
    const end = this.source.indexOf('*/', start + 2);
    const stop = end === -1 ? this.source.length : end + 2;

    this.blockComments.push({
      line: this.lineAt(start),
      endLine: this.lineAt(Math.max(start, stop - 1)),
      text: this.source.slice(start + 2, end === -1 ? this.source.length : end),
      jsdoc: this.source[start + 2] === '*' && this.source[start + 3] !== '/',
      end: stop,
    });

    this.blankUntil(stop);
  }

  private blankUntil(stop: number): void {
    this.code += blank(this.source.slice(this.at, stop));
    this.at = stop;
  }

  private readQuoted(quote: string): void {
    const start = this.at;

    this.at += 1;

    const value = this.readUntil((char) => char === quote || char === '\n');
    const closed = this.source[this.at] === quote;

    this.code += quote + blank(this.source.slice(start + 1, this.at)) + (closed ? quote : '');

    if (closed) {
      this.at += 1;
    }

    this.strings.push({ start, end: this.at, value, line: this.lineAt(start) });
  }

  /** Advances to the first character that stops the literal and answers what was read, escapes resolved. */
  private readUntil(stops: (char: string, next: string) => boolean): string {
    let value = '';

    while (this.at < this.source.length && !stops(this.source.charAt(this.at), this.source.charAt(this.at + 1))) {
      const escaped = this.source[this.at] === '\\';

      value += this.source.charAt(escaped ? this.at + 1 : this.at);
      this.at += escaped ? 2 : 1;
    }

    return value;
  }

  /** Reads template text up to the closing backtick or the next `${`. */
  private readTemplateText(opening: boolean): void {
    const start = this.at;

    if (opening) {
      this.at += 1;
    }

    const value = this.readUntil((char, next) => char === '`' || (char === '$' && next === '{'));
    const interpolates = this.source[this.at] === '$';
    const closed = this.source[this.at] === '`';
    const ending = interpolates ? '${' : closed ? '`' : '';

    this.code += (opening ? '`' : '') + blank(this.source.slice(opening ? start + 1 : start, this.at)) + ending;
    this.at += ending.length;

    if (interpolates) {
      this.templateDepths.push(0);
    } else if (opening) {
      // Only a template without interpolation is a usable module specifier.
      this.strings.push({ start, end: this.at, value, line: this.lineAt(start) });
    }
  }

  private readBraceInTemplate(char: string): void {
    const depth = this.templateDepths.at(-1) ?? 0;

    this.copy(char);

    if (char === '{') {
      this.templateDepths[this.templateDepths.length - 1] = depth + 1;
    } else if (depth > 0) {
      this.templateDepths[this.templateDepths.length - 1] = depth - 1;
    } else {
      this.templateDepths.pop();
      this.readTemplateText(false);
    }
  }

  private regexMayStart(): boolean {
    const trimmed = this.code.trimEnd();

    if (trimmed.length === 0) {
      return true;
    }

    return REGEX_PRECEDERS.has(trimmed.charAt(trimmed.length - 1)) || REGEX_KEYWORDS.test(trimmed.slice(-12));
  }

  private readRegex(): void {
    const start = this.at;
    let inClass = false;

    this.at += 1;

    while (this.at < this.source.length && this.source[this.at] !== '\n') {
      const current = this.source[this.at];

      if (current === '/' && !inClass) {
        break;
      }

      if (current === '[') {
        inClass = true;
      }

      if (current === ']') {
        inClass = false;
      }

      this.at += current === '\\' ? 2 : 1;
    }

    const closed = this.source[this.at] === '/';

    this.code += '/' + blank(this.source.slice(start + 1, this.at)) + (closed ? '/' : '');

    if (closed) {
      this.at += 1;
    }
  }
}
