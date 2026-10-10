const LINE_WIDTH = 120;
const INDENT = '  ';

/** Where a value is printed: how deep, and what shares its line before and after it. */
interface Place {
  readonly depth: number;
  readonly before: number;
  readonly after: number;
}

/**
 * JSON as the formatter of a project lays it out (`biome.json`, width 120), so that a file the
 * CLI writes is already formatted: an object is written one key per line, a list on one line
 * when it holds no object and fits, one entry per line otherwise.
 */
export function formatJson(value: unknown): string {
  return `${print(value, { depth: 0, before: 0, after: 0 })}\n`;
}

function print(value: unknown, place: Place): string {
  if (Array.isArray(value)) {
    return printList(value, place);
  }

  if (typeof value === 'object' && value !== null) {
    return printObject(writtenEntries(value), place.depth);
  }

  return value === undefined ? 'null' : JSON.stringify(value);
}

function printList(entries: readonly unknown[], place: Place): string {
  const onOneLine = entries.every(isInline) ? inline(entries) : undefined;

  if (onOneLine !== undefined && place.before + onOneLine.length + place.after <= LINE_WIDTH) {
    return onOneLine;
  }

  const inner = INDENT.repeat(place.depth + 1);

  const lines = entries.map(
    (entry, index) => `${inner}${print(entry, within(place, inner.length, index < entries.length - 1))}`,
  );

  return `[\n${lines.join(',\n')}\n${INDENT.repeat(place.depth)}]`;
}

function printObject(entries: readonly (readonly [string, unknown])[], depth: number): string {
  if (entries.length === 0) {
    return '{}';
  }

  const inner = INDENT.repeat(depth + 1);

  const lines = entries.map(([key, entry], index) => {
    const name = `${inner}${JSON.stringify(key)}: `;

    return `${name}${print(entry, within({ depth, before: 0, after: 0 }, name.length, index < entries.length - 1))}`;
  });

  return `{\n${lines.join(',\n')}\n${INDENT.repeat(depth)}}`;
}

/** As `JSON.stringify` does, a key without a value is left out. */
function writtenEntries(value: object): (readonly [string, unknown])[] {
  return Object.entries(value).filter(([, entry]) => entry !== undefined);
}

function within(place: Place, before: number, isFollowed: boolean): Place {
  return { depth: place.depth + 1, before, after: isFollowed ? 1 : 0 };
}

/** A plain value, or a list of plain values: what a line can hold without opening a block. */
function isInline(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(isInline);
  }

  return typeof value !== 'object' || value === null;
}

function inline(entries: readonly unknown[]): string {
  return `[${entries.map((entry) => (Array.isArray(entry) ? inline(entry) : JSON.stringify(entry))).join(', ')}]`;
}
