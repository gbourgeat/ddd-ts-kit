import { scan, type Scan } from '../check/scan/scan';

export interface CodeMatch {
  readonly match: RegExpExecArray;
  readonly scanned: Scan;
  /** The source between two offsets: what a group matched in the code, with its strings. */
  slice(start: number, end: number): string;
}

/**
 * Replaces what `pattern` matches in the code of a source, comments and the contents of strings
 * left alone. A replacement answers the text and where it ends, or undefined to keep the match.
 */
export function replaceInCode(
  source: string,
  pattern: RegExp,
  replace: (found: CodeMatch) => { text: string; end?: number } | undefined,
): string {
  const scanned = scan(source);
  const slice = (start: number, end: number): string => source.slice(start, end);
  let result = '';
  let cursor = 0;

  for (const match of scanned.code.matchAll(pattern)) {
    const replaced = match.index < cursor ? undefined : replace({ match, scanned, slice });

    if (replaced !== undefined) {
      result += source.slice(cursor, match.index) + replaced.text;
      cursor = replaced.end ?? match.index + match[0].length;
    }
  }

  return result + source.slice(cursor);
}
