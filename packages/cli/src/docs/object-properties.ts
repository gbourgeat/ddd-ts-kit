import { matchingBracket } from '../check/text/matching-bracket';
import { splitTopLevel } from '../check/text/split-top-level';

/** Where the value of one property of an object literal is: offsets in the text. */
export interface PropertyValue {
  readonly start: number;
  readonly end: number;
}

const KEY = /^(?:([A-Za-z_$][\w$]*)|(['"])(.*?)\2)\s*:/;

/**
 * The properties of the object literal whose brace is at `open`, by name. `code` is the text with
 * its literals blanked (the scan of the checker), `text` the text itself, at the same offsets.
 */
export function objectProperties(code: string, text: string, open: number): Map<string, PropertyValue> {
  const close = matchingBracket(code, open);
  const properties = new Map<string, PropertyValue>();

  for (const part of splitTopLevel(code.slice(open + 1, close))) {
    const start = open + 1 + part.start;
    const written = text.slice(start, start + part.code.length);
    const [whole, identifier, , quoted] = KEY.exec(written) ?? [];

    if (whole !== undefined) {
      properties.set(identifier ?? quoted ?? '', { start: start + whole.length, end: start + part.code.length });
    }
  }

  return properties;
}
