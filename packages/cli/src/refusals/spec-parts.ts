import { scan } from '../check/scan/scan';
import { matchingBracket } from '../check/text/matching-bracket';

const DESCRIBE = /(?<![\w$.])describe\s*\(/;
const IMPORT = /^import [^;]+;\n/gm;

/** The spec of a class per error, cut in two: its imports, and the cases of its first `describe`. */
export interface SpecParts {
  readonly imports: readonly string[];
  /** The body of the `describe`, as written; undefined when the spec has none. */
  readonly cases: string | undefined;
}

export function specParts(source: string): SpecParts {
  const { code } = scan(source);
  const described = DESCRIBE.exec(code);
  const open = described === null ? -1 : code.indexOf('{', described.index);

  return {
    imports: source.match(IMPORT) ?? [],
    cases: open === -1 ? undefined : source.slice(open + 1, matchingBracket(code, open)).replace(/^\n+|\s+$/g, ''),
  };
}
