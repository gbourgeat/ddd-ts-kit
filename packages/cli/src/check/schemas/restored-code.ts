import type { SourceFile } from '../model/source-file';

/** A regular expression literal as the scanner leaves it: its delimiters, its content blanked. */
const BLANKED_PATTERN = /\/ +\//g;

/**
 * The code of a source with its strings and regular expressions given back and its comments
 * still blanked: what a declaration says, without what is written about it.
 */
export function restoredCode(file: SourceFile): string {
  let code = file.scan.code;

  for (const { start, end } of file.scan.strings) {
    code = code.slice(0, start) + file.text.slice(start, end) + code.slice(end);
  }

  return code.replace(BLANKED_PATTERN, (blanked, offset: number) => {
    const original = file.text.slice(offset, offset + blanked.length);

    return original.startsWith('/') && original.endsWith('/') ? original : blanked;
  });
}
