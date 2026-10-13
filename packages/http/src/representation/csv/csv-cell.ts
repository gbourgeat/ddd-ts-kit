import { wireText } from '../wire-text.js';

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
/** What a spreadsheet would run as a formula when the cell starts with it (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell of RFC 4180: the text of the scalar by the rules of every representation, quoted when
 * it holds a quote, a comma, a line break or surrounding spaces. A text that a spreadsheet would
 * run as a formula is prefixed with an apostrophe; a number never is.
 */
export function csvCell(value: unknown): string {
  const text = wireText(value) ?? '';
  const safe = typeof value === 'string' && FORMULA_START.test(text) ? `'${text}` : text;

  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
