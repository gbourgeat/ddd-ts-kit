import { readScalar } from './read-scalar';
import { YamlShapeError } from './yaml-shape-error';

const INDENT = 2;
const BLOCK_HEADER = /^\|(\d)?([-+])?$/;

/**
 * The value of a YAML text written by `toYaml`, which is how the kit writes its contracts: block
 * maps and lists indented by two spaces, plain, single-quoted and double-quoted scalars, literal
 * blocks, and `{}` and `[]` for what is empty. Anything else (a flow collection with content, an
 * anchor, a comment, a folded block) is not something the kit wrote: it throws `YamlShapeError`.
 */
export function fromYaml(text: string): unknown {
  const lines = text.replaceAll('\r\n', '\n').split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  const reader = new YamlReader(lines);
  const value = reader.value(0);

  reader.expectEnd();

  return value;
}

type Value = unknown;

class YamlReader {
  private position = 0;

  constructor(private readonly lines: string[]) {}

  /** The value whose first line is the current one, at an indentation. */
  value(indent: number): Value {
    const line = this.current();

    if (line === undefined) {
      throw new YamlShapeError(this.position, 'a value is missing');
    }

    const body = line.slice(indent);

    if (body.startsWith('- ')) {
      return this.list(indent);
    }

    return isEntry(body) ? this.map(indent) : this.lone(body, indent);
  }

  expectEnd(): void {
    if (this.position < this.lines.length) {
      throw new YamlShapeError(this.position, 'this line is not under the value before it');
    }
  }

  private current(): string | undefined {
    return this.lines[this.position];
  }

  /** A scalar alone on its line, the lines of its literal block at `blockIndent`: the whole document, or an item of a list after its dash. */
  private lone(body: string, blockIndent: number): Value {
    this.position += 1;

    return this.inline(body, blockIndent);
  }

  private map(indent: number): Record<string, Value> {
    const map: Record<string, Value> = {};

    while (this.startsAt(indent) && !this.lineBody(indent).startsWith('- ')) {
      const [key, rest] = splitEntry(this.lineBody(indent), this.position);

      map[key] = this.entryValue(rest, indent);
    }

    return map;
  }

  private list(indent: number): Value[] {
    const list: Value[] = [];

    while (this.startsAt(indent) && this.lineBody(indent).startsWith('- ')) {
      list.push(this.item(indent));
    }

    return list;
  }

  /** An item: what follows its dash is read as if it began a line two columns further in. */
  private item(indent: number): Value {
    const inner = indent + INDENT;
    const body = this.lineBody(indent).slice(INDENT);

    if (body.startsWith('- ') || isEntry(body)) {
      this.replaceCurrent(' '.repeat(inner) + body);

      return this.value(inner);
    }

    return this.lone(body, inner);
  }

  /** The value of `key:` (nested on the lines below) or `key: value`. */
  private entryValue(rest: string | undefined, indent: number): Value {
    this.position += 1;

    if (rest !== undefined) {
      return this.inline(rest, indent + INDENT);
    }

    const next = this.current();
    const inner = indent + INDENT;

    if (next === undefined || indentOf(next) < inner) {
      throw new YamlShapeError(this.position, 'a key has no value');
    }

    return this.value(inner);
  }

  /** A value on the line of its key or dash, the line just read; a literal block takes the lines below, at `blockIndent`. */
  private inline(text: string, blockIndent: number): Value {
    const header = BLOCK_HEADER.exec(text);

    return header === null ? readScalar(text, this.position - 1) : this.literal(header[2] ?? '', blockIndent);
  }

  private literal(chomping: string, blockIndent: number): string {
    const body: string[] = [];

    while (this.position < this.lines.length) {
      const line = this.current() ?? '';

      if (line !== '' && indentOf(line) < blockIndent) {
        break;
      }

      body.push(line.slice(blockIndent));
      this.position += 1;
    }

    return chomped(body, chomping);
  }

  private startsAt(indent: number): boolean {
    const line = this.current();

    return line !== undefined && indentOf(line) === indent;
  }

  private lineBody(indent: number): string {
    return (this.current() ?? '').slice(indent);
  }

  /** The rest of a line after a dash, put back as the line it would be on its own. */
  private replaceCurrent(line: string): void {
    this.lines[this.position] = line;
  }
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** A line that holds a key: a quoted key followed by a colon, or a plain one up to its first `: ` or its final colon. */
function isEntry(body: string): boolean {
  if (body.startsWith("'") || body.startsWith('"')) {
    return /^(?:'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"):(?: |$)/.test(body);
  }

  return body.includes(': ') || (body.endsWith(':') && !BLOCK_HEADER.test(body));
}

/** The key of an entry and what follows its colon on the same line, if anything. */
function splitEntry(body: string, line: number): [string, string | undefined] {
  const quoted = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"):(?: (.*))?$/.exec(body);

  if (quoted !== null) {
    return [String(readScalar(quoted[1] ?? '', line)), quoted[2]];
  }

  const separator = body.indexOf(': ');

  return separator === -1 ? [body.slice(0, -1), undefined] : [body.slice(0, separator), body.slice(separator + 2)];
}

/** `|` keeps one final line break, `|-` none, `|+` every one. */
function chomped(body: readonly string[], chomping: string): string {
  if (chomping === '+') {
    return `${body.join('\n')}\n`;
  }

  const kept = [...body];

  while (kept.at(-1) === '') {
    kept.pop();
  }

  return chomping === '-' ? kept.join('\n') : `${kept.join('\n')}\n`;
}
