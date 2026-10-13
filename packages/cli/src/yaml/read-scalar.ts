import { YamlShapeError } from './yaml-shape-error.js';

/** What starts a scalar the kit never writes plain: a flow collection, an anchor, an alias, a tag, a comment, a folded block. */
const UNWRITTEN = /^[[\]{}&*!#>%@`|]/;
const NUMBER = /^[-+]?\.?\d/;

/**
 * A scalar of one line as `toYaml` writes it: single- or double-quoted text, `{}` or `[]`, and
 * plain text, which is a string unless it reads as null, a boolean or a number (a string that
 * would read so is always quoted).
 */
export function readScalar(text: string, line: number): unknown {
  if (text === '{}' || text === '[]') {
    return text === '{}' ? {} : [];
  }

  if (text.startsWith("'") && text.endsWith("'") && text.length > 1) {
    return text.slice(1, -1).replaceAll("''", "'");
  }

  if (text.startsWith('"')) {
    return doubleQuoted(text, line);
  }

  if (UNWRITTEN.test(text)) {
    throw new YamlShapeError(line, `"${text}" is not a scalar the kit writes`);
  }

  return plain(text, line);
}

function doubleQuoted(text: string, line: number): string {
  try {
    const value: unknown = JSON.parse(text);

    if (typeof value === 'string') {
      return value;
    }
  } catch {
    // Reported below, with the line.
  }

  throw new YamlShapeError(line, `${text} is not a double-quoted text the kit writes`);
}

function plain(text: string, line: number): unknown {
  if (text === 'null' || text === 'true' || text === 'false') {
    return text === 'null' ? null : text === 'true';
  }

  if (!NUMBER.test(text)) {
    return text;
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    throw new YamlShapeError(line, `"${text}" is not a number the kit writes`);
  }

  return number;
}
