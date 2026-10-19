import { scan } from '../check/scan/scan.js';

/** The code of a source, comments and the contents of strings blanked, and its import lines too: what the file reads. */
export function codeWithoutImports(source: string): string {
  return scan(source)
    .code.split('\n')
    .map((line) => (/^\s*import\s/.test(line) ? '' : line))
    .join('\n');
}
