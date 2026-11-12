/**
 * The text a route takes, stated by the route since the bytes alone cannot say it:
 *
 * - `utf-8`, the default: valid UTF-8 and nothing else. It is the strongest proof bytes give of being
 *   text, and what a parser that decodes UTF-8 may read without a second look.
 * - `single-byte`: UTF-8, or text in an encoding of one byte per character that extends ASCII
 *   (Windows-1252, ISO-8859-1 to 16, the code pages of an export of a bank or of a spreadsheet). No
 *   byte sequence is invalid in those, so the proof is weaker: no NUL, no control character other
 *   than tab, line feed, form feed and carriage return, and no UTF-16 or UTF-32 byte order mark.
 *   Whoever reads the file then decodes it: `isUtf8` tells the two cases apart.
 *
 * An option rather than a looser rule for every route: with `single-byte` as the default, each
 * route that reads UTF-8 would receive, without a refusal, a file it decodes wrong. UTF-16 and
 * UTF-32 are refused under both: their NUL bytes are those of a binary file.
 */
export type TextRule = 'utf-8' | 'single-byte';
