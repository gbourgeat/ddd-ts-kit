const INDENT = '  ';

/** What YAML 1.1 or 1.2 reads as something else than a string when written plain: null, booleans, numbers, dates. */
const NOT_A_STRING =
  /^(?:~|null|Null|NULL|true|True|TRUE|false|False|FALSE|y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF|<<|=)$|^[-+]?(?:\.?\d|\.(?:inf|Inf|INF|nan|NaN|NAN)$)|^\d{4}-\d\d?-\d\d?/;

/** A first character that starts something else than a plain scalar. */
const INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`\s]/;

/**
 * The YAML of a JSON value, deterministic and in block style: keys in the order of the value,
 * two spaces per level, a string plain when no YAML reader can take it for something else,
 * single-quoted otherwise, double-quoted when it holds a character only an escape can write, a
 * text of several lines as a literal block. Empty maps and lists are written `{}` and `[]`.
 */
export function toYaml(value: unknown): string {
  return `${new YamlWriter().lines(value, 0).join('\n')}\n`;
}

class YamlWriter {
  /** The lines of a value that starts on its own line, at a depth. */
  lines(value: unknown, depth: number): string[] {
    if (isMap(value)) {
      return Object.keys(value).length === 0 ? ['{}'] : this.mapLines(value, depth);
    }

    if (Array.isArray(value)) {
      return value.length === 0 ? ['[]'] : this.listLines(value, depth);
    }

    return [this.inline(value, depth)];
  }

  private mapLines(map: Readonly<Record<string, unknown>>, depth: number): string[] {
    const indent = INDENT.repeat(depth);

    return Object.entries(map).flatMap(([key, entry]) => {
      const name = `${indent}${scalar(key)}:`;

      if (isNested(entry)) {
        return [name, ...this.lines(entry, depth + 1)];
      }

      return [`${name} ${this.inline(entry, depth + 1)}`];
    });
  }

  private listLines(list: readonly unknown[], depth: number): string[] {
    const indent = INDENT.repeat(depth);

    return list.flatMap((entry) => {
      if (!isNested(entry)) {
        return [`${indent}- ${this.inline(entry, depth + 1)}`];
      }

      // The first line of a nested map or list goes after the dash; the others keep their depth.
      const [first = '', ...rest] = this.lines(entry, depth + 1);

      return [`${indent}- ${first.trimStart()}`, ...rest];
    });
  }

  /** A value written after `key:` or `-`, a block scalar included: its lines are indented one level deeper. */
  private inline(value: unknown, depth: number): string {
    if (isMap(value) || Array.isArray(value)) {
      return isMap(value) ? '{}' : '[]';
    }

    if (typeof value === 'string' && isBlockText(value)) {
      return literalBlock(value, INDENT.repeat(depth));
    }

    return scalar(value);
  }
}

function isMap(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A map or a list with something in it: written on the lines below its key. */
function isNested(value: unknown): boolean {
  return (isMap(value) && Object.keys(value).length > 0) || (Array.isArray(value) && value.length > 0);
}

/** A key, or a value that fits one line. */
function scalar(value: unknown): string {
  if (typeof value === 'string') {
    return quoted(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }

  return typeof value === 'boolean' ? String(value) : 'null';
}

function quoted(text: string): string {
  if (hasUnprintable(text) || text.includes('\n') || text.includes('\r')) {
    return doubleQuoted(text);
  }

  return isPlain(text) ? text : `'${text.replaceAll("'", "''")}'`;
}

function isPlain(text: string): boolean {
  return (
    text !== '' &&
    !INDICATOR.test(text) &&
    !/\s$/.test(text) &&
    !text.endsWith(':') &&
    !text.includes(': ') &&
    !text.includes(' #') &&
    !text.includes('\t') &&
    !NOT_A_STRING.test(text)
  );
}

/** A character a plain or single-quoted scalar cannot hold as it is: a control character but the tab and the line feed, a C1 control, a line or paragraph separator, a byte order mark. */
function hasUnprintable(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if ((code < 0x20 && code !== 0x09 && code !== 0x0a) || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }

    if (code === 0x2028 || code === 0x2029 || code === 0xfeff) {
      return true;
    }
  }

  return false;
}

/** JSON's escapes are YAML's, plus the line and paragraph separators and the C1 controls, which JSON leaves raw. */
function doubleQuoted(text: string): string {
  return JSON.stringify(text).replace(
    /[\u007f-\u009f\u2028\u2029\ufeff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Several lines of printable text, which a literal block keeps byte for byte. */
function isBlockText(text: string): boolean {
  return text.includes('\n') && !text.includes('\r') && !hasUnprintable(text) && text.trim() !== '';
}

/**
 * `|` keeps one final line break, `|-` none, `|+` every one. The indentation is stated when the
 * first line that holds something starts with a space, which a reader would take for indentation.
 */
function literalBlock(text: string, indent: string): string {
  const trailing = trailingLineBreaks(text);
  const chomping = trailing === 0 ? '-' : trailing === 1 ? '' : '+';
  const body = trailing === 0 ? text : text.slice(0, -1);
  const firstFilled = body.split('\n').find((line) => line !== '') ?? '';
  const stated = firstFilled.startsWith(' ') ? String(INDENT.length) : '';
  const lines = body.split('\n').map((line) => (line === '' ? '' : `${indent}${line}`));

  return [`|${stated}${chomping}`, ...lines].join('\n');
}

function trailingLineBreaks(text: string): number {
  let count = 0;

  while (count < text.length && text[text.length - 1 - count] === '\n') {
    count += 1;
  }

  return count;
}
